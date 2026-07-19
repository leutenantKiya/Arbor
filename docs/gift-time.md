# Gift Time Feature

## Overview

Adds a "Gift time" section to the `/time` page that lets a signed-in user transfer viewing time (in seconds) to another Arbor user by wallet address.

## Files added

### `app/api/gift/route.ts`

- `POST /api/gift` — authenticated endpoint.
- Validates `recipientWalletAddress` (`0x[a-fA-F0-9]{40}`) and `seconds` (positive integer).
- Looks up sender (`session.userId`) and recipient (`users.walletAddress`).
- Rejects if:
  - Sender balance < seconds
  - Recipient does not exist
  - Sender == recipient
- Atomically executes one implicit transaction via chained CTEs:
  1. `check` — locks sender row and asserts sufficient balance
  2. `debit` — subtracts seconds from sender
  3. `credit` — adds seconds to recipient (only if debit succeeded)
  4. `gift_claims` — records the gift with a random UUID token hash
- Returns `{ success: true, seconds }`.

### `components/gift-form.tsx`

- Client form rendered only when `initialBalanceSeconds > 0`.
- Fields:
  - Recipient wallet address
  - Amount in seconds (max = current balance)
- State machine: `idle` → `loading` → `success` / `error`.
- On success: shows confirmation then reloads the page to reflect the new balance.

## Files updated

### `app/time/page.tsx`

- Imports `GiftForm`.
- Renders a new "Gift time" card below the purchase packages when the user is signed in.
- Passes the signed-in user's current balance as `initialBalanceSeconds`.

## Design decisions

- **Wallet address as recipient identity** is the fastest path because every signed-in user already has a `wallet_address` on `users`, visible in the nav.
- The server-side atomic CTE mirrors the existing heartbeat/rollup style: one implicit transaction, no external queue or worker.
- A random UUID token is stored as `token_hash` in `gift_claims` so the schema is already ready for a future email claim-link flow without a migration.

## Follow-up

- Email gifting: generate a claim token, send a link, recipient claims it on sign-in.
- Recipient lookup by email or username instead of raw wallet address.
