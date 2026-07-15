# Arbor Session Billing — Heartbeat Metering (identity model B)

> Dual-FSM watch-time metering. Server clock is the only source of billed time.
> One canonical identity: **`session.userId` is always `users.id`**, for every
> login method. `accounts` (email/password) links to its ledger `users` row via
> `users.account_id`; Particle sign-in already signs `users.id` directly.

---

## FIRST: apply the `account_id` column to the DB

The app is broken until this lands — Drizzle emits `account_id` in every
`INSERT INTO users`, so sign-in 500s with `column "account_id" ... does not
exist` while the column is missing.

`drizzle-kit push` stalled earlier, so the reliable path is the Neon SQL editor
(Neon console → your project → SQL Editor) — paste and run:

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id);

CREATE UNIQUE INDEX IF NOT EXISTS users_account_id_unique
  ON users (account_id) WHERE account_id IS NOT NULL;
```

This is exactly what the Drizzle schema declares. Alternatively retry
`npx drizzle-kit push` and, if it prints a diff, choose **create column** /
answer **Yes** — but the SQL above is deterministic.

---

## Files (all in this project — `Arbor Main 2.0\Arbor`)

| File | Change |
|---|---|
| `lib/db/schema.ts` | `users.account_id` (nullable unique FK → accounts) — already present |
| `lib/billing.ts` | **new** — `DEV_SEED_BALANCE_SECONDS`, `MAX_HEARTBEAT_DELTA_SECONDS` |
| `lib/auth/sign-in/actions.ts` | password login now resolves/creates the `users` row and signs **`users.id`** (was `accounts.id`) |
| `app/api/auth/verify/route.ts` | Particle login seeds `DEV_SEED_BALANCE_SECONDS` on first insert (TODO: remove with purchase flow) |
| `app/api/session/start/route.ts` | keys off `session.userId` as `users.id`; blocks at balance ≤ 0 |
| `app/api/session/heartbeat/route.ts` | one atomic CTE; identity check is `ps.user_id = session.userId` |
| `app/api/session/end/route.ts` | idempotent close; `ps.user_id = session.userId` |
| `components/video-player.tsx` | client heartbeat FSM (no identity logic) |
| `app/watch/[slug]/page.tsx` | auth-gated, renders `<VideoPlayer />` |

---

## Commands (you run these)

```bash
# after applying the column SQL above:
npx tsc --noEmit     # typecheck
npm run dev          # restart so the DB + code changes are fresh
```

## Verify

1. Google (Particle) sign-in → no 500; `verify` inserts a `users` row with 3600s.
2. Open a film, press Play → one `POST /api/session/start` → `{ sessionId, remainingSeconds: 3600 }`.
3. Watch 30s → three `POST /api/session/heartbeat`, 10s apart, `remainingSeconds` dropping. Gauge top-right mirrors it.
4. Neon (see "Two-tier billing" below — beats now land in `debit_staging`, not `debit_events`):
   ```sql
   SELECT balance_seconds FROM users;                          -- decreasing live
   SELECT * FROM debit_staging ORDER BY created_at DESC;        -- one row per beat, while watching
   SELECT * FROM debit_events ORDER BY id DESC;                 -- one row per session, after close
   SELECT pending_cents FROM filmmakers;                        -- accrues at session close
   SELECT last_seq, active, audited_at FROM playback_sessions ORDER BY started_at DESC;
   ```
5. Pause → `POST /api/session/end`, session `active = false`, `audited_at` set, one `debit_events` row appears.
6. Exhaustion test: `UPDATE users SET balance_seconds = 15;` then Play → after ~2 beats the debit caps at remaining, session auto-ends (`sessionEnded: true`), player shows "Watch time used up".

## Rate & guards

- 10 s watched = 1 cent total; filmmaker keeps 90% (`ROUND(seconds × 0.9 / 10)`).
- Server-clock delta capped at 12 s. Each beat debits `min(delta, remaining)`; auto-ends at 0. The `balance_seconds >= 0` check constraint is never tripped.
- Monotonic `seq` per session; a failed beat retries the **same** seq (server clock prevents over-billing).

## Dev-only bits to remove later

- `DEV_SEED_BALANCE_SECONDS` seeding in both `sign-in/actions.ts` and
  `verify/route.ts` — replace with the real purchase flow (`/api/purchase/confirm`).

---

## Live balance UI (added 2026-07-16)

Problem: the nav pill was a **server component** — balance baked into HTML at
page load, frozen until refresh. The player gauge only changed on each 10s
heartbeat ack, so it jumped in 10s steps.

Fix — display-only, server stays the sole billing authority:

| File | Change |
|---|---|
| `lib/balance-bus.ts` | **new** — window CustomEvent bus carrying `{ remainingSeconds, playing }` |
| `components/balance-pill.tsx` | **new** — client pill: renders the server value first (no loading flash), resyncs on every bus signal, ticks down 1 s/s while `playing` |
| `components/nav.tsx` | static balance `<span>` → `<BalancePill initialSeconds={balance} />`; the server-side DB query is unchanged |
| `components/video-player.tsx` | gauge interpolates 1 s/s between acks; emits a bus signal on start ack, every heartbeat ack, pause, exhaustion (0), and unmount (freeze pill) |

```
heartbeat ack (server truth, every 10s)
      │
      ▼
emitBalance({remainingSeconds, playing}) ──► gauge  (m:ss, ticks 1s locally)
                                        └──► pill   (h/m,  ticks 1s locally)
```

Between acks both displays count down locally (cosmetic interpolation); every
ack snaps them back to the server-confirmed number, so maximum display drift
is one heartbeat interval. Pause / navigation away freezes the pill at the
last confirmed value.

The client numbers are never sent to the server — the heartbeat request is
still only `{ sessionId, seq }`.

---

## Two-tier billing: hot staging + rollup audit (added 2026-07-16)

**Why.** The old design wrote one `debit_events` row *per 10s beat* — the
permanent audit table grew with time-watched (≈360k rows/hour at 1k concurrent).
Now beats land in a cheap **hot tier** that's rolled up into **one permanent
audit row per session** at close, then purged after 7 days. Long-term storage
grows per *session*, not per beat (~60× fewer permanent rows). User billing is
unchanged: `users.balance_seconds` is still debited **live** every beat.

### Apply the migration first (Neon SQL editor)

```sql
CREATE TABLE IF NOT EXISTS debit_staging (
  session_id uuid NOT NULL REFERENCES playback_sessions(id),
  seq        integer NOT NULL,
  seconds    integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, seq)
);
CREATE INDEX IF NOT EXISTS debit_staging_created_idx ON debit_staging (created_at);

ALTER TABLE playback_sessions ADD COLUMN IF NOT EXISTS audited_at timestamptz;
```

Optional — clear the old per-beat rows accumulated during testing so Studio
totals start clean (dev data only):

```sql
TRUNCATE debit_staging;
DELETE FROM debit_events;            -- old per-beat rows
UPDATE filmmakers SET pending_cents = 0;
-- (top balances back up if you want: UPDATE users SET balance_seconds = 3600;)
```

### The two tiers

| Tier | Table | Written | Lifetime | Role |
|---|---|---|---|---|
| Hot | `debit_staging` | 1 row **per beat** | purged after 7 days | crash-survivable working record; source of truth for an in-flight session |
| Cold | `debit_events` | 1 row **per session** (at close) | permanent | the audit ledger Studio + settlement read |

### Per beat (heartbeat, one atomic statement)

`INSERT debit_staging(session_id, seq, seconds)` · `UPDATE playback_sessions`
(last_seq/last_beat_at, auto-end at 0) · `UPDATE users balance_seconds -= delta`.
No `debit_events` / filmmaker write. `ON CONFLICT (session_id, seq) DO NOTHING`
makes a raced duplicate a no-op — replay protection is now enforced by the PK,
on top of the existing `seq > last_seq` check.

### At close (rollup — `lib/db/rollup.ts`)

`rollupSession(id)`: `SUM(debit_staging.seconds)` → **one** `debit_events` row +
filmmaker 90% accrual (rounded once on the session total — more accurate than
the old per-beat rounding, which inflated payouts), then stamps `audited_at`.
Idempotent: the `FOR UPDATE ... WHERE audited_at IS NULL` guard means a repeat
call (or a concurrent one) is a no-op — no double billing.

Every close path funnels through it:

| Path | Trigger |
|---|---|
| `/api/session/end` | pause / ended / unmount / `sendBeacon` on unload |
| heartbeat exhaustion | balance hits 0 mid-beat → route calls `rollupSession` |
| `/api/session/start` | rolls up the user's previous still-active (crashed) session |
| `/api/session/sweep` | dead sessions (no beat > 60s) — the crash safety net |

### Crash safety

Because balance is debited live, a crash costs the user at most ~12s (their
favor). What a dead session leaves dangling is only *bookkeeping* — its staging
rows never got rolled into `debit_events`, so the filmmaker accrual is pending.
`/api/session/sweep` closes+audits any unaudited session with no beat for 60s
and purges staging older than 7 days. `vercel.json` runs it daily (03:00 UTC);
hit it manually anytime: `GET /api/session/sweep` → `{ sessionsAudited, stagingRowsPurged }`.
Set `CRON_SECRET` in prod to require `Authorization: Bearer <secret>` (Vercel
Cron sends it automatically); unprotected in dev when the env var is absent.

### Ledger invariant (unchanged, now two-term mid-session)

`balance_seconds = Σ purchases + Σ gifts − Σ debit_events − Σ (staging of active sessions)`.
Fully recomputable and auditable; the staging term is zero once every session
has closed.

### Files

| File | Change |
|---|---|
| `lib/db/schema.ts` | **new** `debit_staging` table (PK `session_id,seq`); `playback_sessions.audited_at` |
| `lib/db/rollup.ts` | **new** — `rollupSession()`, the idempotent per-session audit |
| `app/api/session/heartbeat/route.ts` | writes `debit_staging` (was `debit_events`); no per-beat filmmaker accrual; rolls up on exhaustion |
| `app/api/session/end/route.ts` | ownership check → `rollupSession` |
| `app/api/session/start/route.ts` | lazy-close now rolls up the stale session |
| `app/api/session/sweep/route.ts` | **new** — dead-session rollup + 7-day staging purge (cron) |
| `vercel.json` | **new** — daily cron → `/api/session/sweep` |

### Verify

1. Play a film, watch ~30s. `SELECT * FROM debit_staging` → rows accumulating,
   one per beat. `debit_events` still has **no** row for this session yet.
2. Pause. Now `debit_events` has **one** row = total seconds; `filmmakers.pending_cents`
   jumped; `playback_sessions.audited_at` is set.
3. Play again, then kill the tab (don't pause). Wait, then either open a new
   film (lazy close) or `GET /api/session/sweep` → the crashed session gets its
   one `debit_events` row.
4. Studio (`/studio`) totals match — the SUM over one-row-per-session equals the
   old per-beat SUM.

### Not touched — `lib/db/functions.sql`

Those Postgres stored functions (`heartbeat_tick`, etc.) are a parallel
implementation **the app never calls** (only `scripts/install-db-functions.ts`
loads them). They still do per-beat `debit_events` inserts and are now stale —
safe to delete; they have no runtime effect on the routes above.
