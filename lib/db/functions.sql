-- Find-or-create the ledger `users` row for a given identity key.
-- p_identity_key is accounts.id today, a real Particle UUID once wired in.
create or replace function get_or_create_ledger_user(
  p_identity_key text,
  p_wallet_address text default ''
) returns users as $$
declare
  v_user users;
begin
  insert into users (particle_uuid, wallet_address, balance_seconds)
  values (p_identity_key, p_wallet_address, 0)
  on conflict (particle_uuid) do update
    set particle_uuid = users.particle_uuid
  returning * into v_user;

  return v_user;
end;
$$ language plpgsql;

-- Starts a session: blocks on zero balance, closes any stale active
-- session, inserts the new one. One call, one transaction.
create or replace function start_playback_session(
  p_user_id uuid,
  p_film_id uuid
) returns table (status text, session_id uuid) as $$
declare
  v_balance integer;
  v_session_id uuid;
begin
  select balance_seconds into v_balance
  from users where id = p_user_id
  for update;

  if v_balance is null then
    return query select 'user_not_found', null::uuid; return;
  end if;

  if v_balance <= 0 then
    return query select 'insufficient_balance', null::uuid; return;
  end if;

  update playback_sessions
  set active = false, ended_at = now()
  where user_id = p_user_id and active = true;

  insert into playback_sessions (user_id, film_id, active, last_seq, last_beat_at, started_at)
  values (p_user_id, p_film_id, true, 0, now(), now())
  returning id into v_session_id;

  return query select 'ok', v_session_id;
end;
$$ language plpgsql;

-- The heartbeat FSM tick: validate ownership/state -> bounded delta ->
-- debit -> log -> advance sequence pointer. All atomic, all in one call.
create or replace function heartbeat_tick(
  p_session_id uuid,
  p_user_id uuid,
  p_seq integer,
  p_max_delta_seconds integer default 10,
  p_cents_per_second numeric default 0.1,
  p_filmmaker_share numeric default 0.9
) returns table (
  status text,
  remaining_seconds integer,
  debited_seconds integer,
  ended boolean
) as $$
declare
  v_session playback_sessions%rowtype;
  v_balance integer;
  v_delta numeric;
  v_debit integer;
  v_filmmaker_cents integer;
  v_new_balance integer;
begin
  select * into v_session
  from playback_sessions where id = p_session_id
  for update;

  if not found then
    return query select 'not_found', null::integer, null::integer, false; return;
  end if;

  if v_session.user_id <> p_user_id then
    return query select 'forbidden', null::integer, null::integer, false; return;
  end if;

  if not v_session.active then
    return query select 'inactive', null::integer, null::integer, false; return;
  end if;

  if p_seq <= v_session.last_seq then
    select balance_seconds into v_balance from users where id = p_user_id;
    return query select 'duplicate', v_balance, 0, false; return;
  end if;

  select balance_seconds into v_balance
  from users where id = p_user_id
  for update;

  v_delta := greatest(0, least(
    extract(epoch from (now() - coalesce(v_session.last_beat_at, v_session.started_at))),
    p_max_delta_seconds
  ));
  v_debit := least(v_delta, v_balance)::integer;

  if v_debit <= 0 then
    update playback_sessions
    set active = false, ended_at = now()
    where id = p_session_id;
    return query select 'insufficient_balance', v_balance, 0, true; return;
  end if;

  v_filmmaker_cents := round(v_debit * p_cents_per_second * p_filmmaker_share);

  update users
  set balance_seconds = balance_seconds - v_debit
  where id = p_user_id
  returning balance_seconds into v_new_balance;

  insert into debit_events (session_id, seconds, filmmaker_cents)
  values (p_session_id, v_debit, v_filmmaker_cents);

  update playback_sessions
  set last_seq = p_seq, last_beat_at = now()
  where id = p_session_id;

  return query select 'ok', v_new_balance, v_debit, false;
end;
$$ language plpgsql;