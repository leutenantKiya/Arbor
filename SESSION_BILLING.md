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
4. Neon:
   ```sql
   SELECT balance_seconds FROM users;                 -- decreasing
   SELECT * FROM debit_events ORDER BY id DESC;        -- one row/beat, seconds ≤ 12
   SELECT pending_cents FROM filmmakers;               -- accruing (90%)
   SELECT last_seq, active FROM playback_sessions ORDER BY started_at DESC;
   ```
5. Pause → `POST /api/session/end`, session `active = false`.
6. Exhaustion test: `UPDATE users SET balance_seconds = 15;` then Play → after ~2 beats the debit caps at remaining, session auto-ends (`sessionEnded: true`), player shows "Watch time used up".

## Rate & guards

- 10 s watched = 1 cent total; filmmaker keeps 90% (`ROUND(seconds × 0.9 / 10)`).
- Server-clock delta capped at 12 s. Each beat debits `min(delta, remaining)`; auto-ends at 0. The `balance_seconds >= 0` check constraint is never tripped.
- Monotonic `seq` per session; a failed beat retries the **same** seq (server clock prevents over-billing).

## Dev-only bits to remove later

- `DEV_SEED_BALANCE_SECONDS` seeding in both `sign-in/actions.ts` and
  `verify/route.ts` — replace with the real purchase flow (`/api/purchase/confirm`).
