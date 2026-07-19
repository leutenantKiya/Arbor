# Race Condition Fixes — Audit Notes

**Scope:** Two concurrency defects fixed in the Arbor ledger API layer.
**Date:** 2026-07-20
**Files changed:** `app/api/gift/route.ts`, `app/api/session/start/route.ts`
**Validation:** `npm run typecheck` passes. No executed integration test exists for
these mutations — correctness rests on Postgres row-lock semantics + code review.
**Stack note:** the neon-http driver supports only a single implicit transaction per
statement, so all atomic work must live inside ONE `sql` statement (chained CTEs),
not `db.transaction(...)`.

---

## 1. Gift transfer — TOCTOU in balance pre-check

**File:** `app/api/gift/route.ts`
**Risk:** Over-gifting / balance inconsistency under concurrent requests.

### Before (vulnerable)
The route did a **separate read** of the sender's balance, checked
`balance_seconds >= seconds`, returned `403` if short — and *only then* ran a second
statement that actually debited under `FOR UPDATE`. Between the read and the debit,
no lock was held.

```
SELECT balance_seconds FROM users WHERE id = sender          -- no lock
if (balance < seconds) return 403
... later ...
UPDATE users SET balance = balance - seconds WHERE id = sender FOR UPDATE
```

Two near-simultaneous gift requests from the same sender could **both** pass the
pre-check (neither had locked the row yet), then both debit — spending beyond the
available balance (guarded from going negative only by the `balance_seconds >= 0`
CHECK, but recipient could still be credited time the sender didn't hold).

### After (fixed)
Every step is now a **single statement** with the sender row locked from the start:

- `sender_check` — `SELECT ... WHERE id = sender AND balance_seconds >= seconds
  FOR UPDATE OF u` (balance predicate evaluated **under the lock**).
- `debit` — `UPDATE users SET balance = balance - seconds FROM sender_check`
  (only runs if the locked row satisfied the predicate).
- `credit` — `UPDATE users SET balance = balance + seconds ... WHERE EXISTS debit`.
- `INSERT INTO gift_claims ... FROM sender_check, recipient WHERE EXISTS debit`.

The recipient lookup (`recipient` CTE) is also folded in. Concurrent gifts now
**serialize on the sender row lock**; the second transaction re-reads the already
reduced balance and its `sender_check` predicate fails, so no debit/credit/claim
occurs for it.

### Error handling
If the statement inserts 0 rows, a fallback distinguishes causes:
`recipient_not_found` (404) → `cannot_gift_to_self` (400) → `insufficient_balance` (403).
The unused `giftClaims` import was removed (the table is referenced by literal name
`gift_claims` inside the raw SQL).

### Audit caveats
- Self-gift (`cannot_gift_to_self`) is enforced only in the **fallback** path, not
  inside the atomic statement. If a user gifts to their own wallet, the locked
  `sender_check` row and the `recipient` row resolve to the **same `users` row**, so
  `debit` and `credit` both target it and net to zero — no double-spend, but a
  `gift_claims` row IS still written and 0 rows are returned, routing to the 400.
  Functionally safe; consider rejecting self-gift inside the SQL for clarity.
- The `gift_claims` claim half is **not implemented** (see §3). This fix only makes
  the *transfer* atomic.

---

## 2. Session start — non-atomic check + unique-index collision

**File:** `app/api/session/start/route.ts`
**Risk:** HTTP 500 on `one_active_session_per_user` collision; interleaved
balance/insert; unclean start under concurrency.

### Before (vulnerable)
Four separate steps, none under a lock:
1. `SELECT balance_seconds` (read)
2. `if (balance <= 0) return 403`
3. `rollupSession(stale active sessions)` — separate statement(s)
4. `INSERT INTO playback_sessions ...` — separate statement

The `playback_sessions` table has a **partial unique index**
`one_active_session_per_user ON (user_id) WHERE active = true`.
Two concurrent `start` calls for the same user could both read a positive balance
and both reach step 4; the second insert collides on the unique index → Postgres
throws → unhandled 500 to the client. The stale-close (step 3) and insert (step 4)
could also interleave.

### After (fixed)
The balance read + status decision runs in **one locked statement**:

```sql
WITH me AS (
  SELECT u.id, u.balance_seconds FROM users u
  WHERE u.id = sender FOR UPDATE OF u
),
close_stale AS ( SELECT ps.id FROM playback_sessions ps, me
                 WHERE ps.user_id = me.id AND ps.active = true )
SELECT CASE WHEN (balance IS NULL) THEN 'user_not_found'
            WHEN (balance <= 0)  THEN 'insufficient_balance'
            ELSE 'ok' END AS status,
       balance AS remaining_seconds
```

Because `me` is `FOR UPDATE`, concurrent starts **serialize** on the user row and
see a consistent balance. The status is returned cleanly as 401/403/200 — no more
unique-index 500.

The `rollupSession(stale)` + `INSERT` still run as follow-up statements, but now
they execute **after** the balance decision is locked in. `rollupSession` is
idempotent (its `WHERE audited_at IS NULL FOR UPDATE` re-checks under lock via
EvalPlanQual) and the sweep cron re-runs it, so a crash between rollup and insert is
safe. The new insert can no longer collide because all prior active sessions are
rolled up (set `active = false`) before it.

### Audit caveats
- The `rollup + insert` still isn't a single atomic unit. It is *safe* (idempotent
  rollup + partial-unique-index freeing + crash-recoverable), but a strict auditor
  may prefer folding the rollup's `active=false` update directly into this statement
  or into a single DB function (`start_playback_session` already exists in
  `lib/db/functions.sql` and does exactly this pattern — consider routing through it).
- `users` import removed (no longer referenced); `sql` import added.

---

## 3. `gift_claims` usage status (for context)

- **Written:** yes, every gift inserts a row (`app/api/gift/route.ts:69`).
- **Read / claimed:** NO — there is no `gift/claim` route and no code references
  `token_hash`, `claimed_at`, or the `giftClaims` Drizzle object. `app/gift/[token]`
  is a disabled "Day-1 shell".
- **Single-use guard:** NOT enforced. The current flow credits the recipient
  **instantly** at send time (`credit` CTE, `claimed_at = now()` at creation), so
  `gift_claims` currently serves only as an audit log, not a claim token. The
  `token_hash UNIQUE` index and `claimed_at` column are vestigial until a real
  claim flow is built.

---

## What was deliberately NOT changed (already correct)

| Path | Why safe |
|---|---|
| `app/api/session/heartbeat` | Single statement, `FOR UPDATE OF ps, u`, monotonic `seq > last_seq`, `debit_staging (session_id, seq)` PK + `ON CONFLICT DO NOTHING` |
| `lib/db/rollup.ts` | `WHERE audited_at IS NULL FOR UPDATE`; EvalPlanQual re-check prevents double-accrual |
| `app/api/purchase/confirm` | Idempotent via `purchases.tx_hash UNIQUE` |
| `lib/db/functions.sql` `get_or_create_ledger_user` | `ON CONFLICT` upsert handles concurrent create |

## Open items for deeper audit
1. Settlement double-pay: verify `lib/services/settlement.service.ts` re-checks the
   chain by nonce between the accrual-zero step and the `settle()` send (two
   statements — a crash window). Not changed in this pass.
2. Gift self-gift guard inside SQL (§1 caveat).
3. Session-start: optionally route through `start_playback_session()` SQL function
   for a fully single-statement start (§2 caveat).
