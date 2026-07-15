# Arbor — Change Log
> **Session:** 2026-07-13  
> **Scope:** Auth system, Time page, Studio page, Nav, Database schema

---

## Summary

The app had three major broken areas:

| Area | Root Problem | Status |
|---|---|---|
| Sign-in / Sign-up | Depended on `NEON_AUTH_BASE_URL` (a placeholder URL) | ✅ Fixed |
| Time page | Buttons disabled, no session awareness | ✅ Fixed |
| Studio page | Used hardcoded static data instead of DB | ✅ Fixed |
| Nav | Hardcoded balance ("2h 30m"), always showed "Sign in" | ✅ Fixed |
| Database | `accounts` table missing, films table empty | ✅ Fixed |

---

## 1. Auth System — Complete Replacement

### Problem
The original auth used `@neondatabase/neon-js` which internally calls a **Neon Auth** managed service. This requires a real `NEON_AUTH_BASE_URL` environment variable pointing to a live Neon Auth endpoint. The `.env` file had a placeholder `ep-xxx` URL, so **every sign-in and sign-up attempt would silently fail** or throw a network error.

Additionally:
- Sign-in action redirected to `/posts` — a route that does not exist
- Sign-up action also redirected to `/posts`

### Solution
Replaced the external auth dependency with a **self-contained email + password auth stack** built entirely from packages already in the project:

- **`jose`** (already listed in `package.json`) — JWT session tokens
- **Web Crypto API** (built into Node.js / Next.js edge runtime) — PBKDF2 password hashing
- **Drizzle ORM + Neon Postgres** (already set up) — store accounts in a new `accounts` table

No new npm packages were installed.

### New Files Created

#### `lib/auth/password.ts`
Handles password hashing and verification using **PBKDF2-SHA256** via `crypto.subtle` (Web Crypto API).

- `hashPassword(password)` — returns a string in the format `pbkdf2:100000:<hex-salt>:<hex-hash>`
- `verifyPassword(password, stored)` — returns `true`/`false` using constant-time comparison to prevent timing attacks
- 100,000 iterations, 256-bit key, 16-byte random salt per password

#### `lib/auth/session.ts`
Manages **JWT sessions** using `jose`.

- `createSession(payload)` — signs a JWT with `HS256`, stores it in an **HttpOnly cookie** (`arbor-session`) that expires in 7 days
- `getSession()` — reads and verifies the JWT from the cookie, returns `{ userId, email, name }` or `null`
- `deleteSession()` — clears the cookie (used for sign-out)
- Uses `AUTH_SECRET` env var as the signing key

#### `lib/auth/sign-out/actions.ts`
A server action that calls `deleteSession()` then redirects to `/auth/sign-in`.

### Modified Files

#### `lib/auth/sign-in/actions.ts` (rewritten)

```
Before: auth.signIn.email({ email, password }) → redirect('/posts')

After:
  1. Normalize email (trim + lowercase)
  2. Query accounts table by email
  3. verifyPassword(password, account.passwordHash)
  4. createSession({ userId, email, name })
  5. redirect('/')
```

#### `lib/auth/sign-up/actions.ts` (rewritten)

```
Before: auth.signUp.email({ name, email, password }) → redirect('/posts')

After:
  1. Validate all fields (min password length: 8 chars)
  2. Check no existing account with that email
  3. hashPassword(password)
  4. db.insert(accounts).values({ name, email, passwordHash })
  5. createSession({ userId, email, name })
  6. redirect('/')
```

#### `lib/auth/server.ts` (rewritten)

```
Before: createNeonAuth({ baseUrl: NEON_AUTH_BASE_URL, cookies: { secret: ... } })
After:  re-exports getSession, createSession, deleteSession from ./session
```

#### `lib/auth/client.ts` (rewritten)

```
Before: import { createAuthClient } from '@neondatabase/neon-js/auth/next'
After:  empty module — auth state is read server-side
```

---

## 2. Database Schema — New `accounts` Table

### File: `lib/db/schema.ts`

Added at the top of the schema file:

```ts
export const accounts = pgTable(
  "accounts",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    email:        text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name:         text("name").notNull().default(""),
    walletAddress: text("wallet_address").notNull().default("0x000..."),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("accounts_email_unique").on(t.email)],
);
```

The `uniqueIndex` on `email` prevents duplicate registrations at the database level.

### Commands Run

```bash
npm run db:push   # Applied schema to Neon Postgres — created the accounts table
npm run db:seed   # Inserted 6 films + their filmmakers into the DB
```

Seed output:
```
seeded: Sintel
seeded: Tears of Steel
seeded: Big Buck Bunny
seeded: Elephants Dream
seeded: Cosmos Laundromat
seeded: Spring
done.
```

---

## 3. Environment Variables — `AUTH_SECRET` Set

### Files: `.env` and `.env.local`

```
Before: AUTH_SECRET=""
After:  AUTH_SECRET="/O/JEB+y3AaBhh9bq8aURd9/DJEUBZwLDJNJ7bfsebRm"
```

This is required for `jose` to sign and verify JWT tokens. Without it, every `getSession()` call throws `AUTH_SECRET env var is not set`.

The `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET` variables are kept in the file but are no longer used by the auth code.

---

## 4. Nav — Live Session State

### File: `components/nav.tsx` (rewritten)

**Before:** A purely static component. Always showed:
- Hardcoded `"2h 30m"` balance pill
- Always showed "Sign in" link regardless of auth state

**After:** A **server component** that:
1. Calls `getSession()` to check if user is logged in
2. If logged in — queries `users.balanceSeconds` from the DB, shows formatted balance + user name + **Sign out** button
3. If not logged in — shows "Add time" link + "Sign in" link

Balance formatting examples:
- `9000` seconds → `"2h 30m"`
- `300` seconds → `"5m"`
- `0` seconds → `"0m"`

### New File: `components/nav-sign-out.tsx`

A tiny `'use client'` component wrapping the sign-out server action in a `<form>`. Required because Next.js server actions invoked from buttons need either a form element or a client component.

---

## 5. Time Page — Auth-Aware

### File: `app/time/page.tsx` (rewritten)

**Before:**
- All purchase buttons were `disabled` with hardcoded text "Sign in to add time"
- No session check at all
- No real balance displayed

**After:** A **server component** that:
1. Reads the session via `getSession()`
2. If signed in — fetches `balanceSeconds` from the `users` table, shows a **live balance card**
3. If not signed in — shows a prompt card with a "Sign in" link
4. Package cards — signed-in users see "Purchase coming soon" (on-chain wiring is the next milestone); guests see a link to sign-in

---

## 6. Studio Page — DB-Backed Earnings

### File: `app/studio/page.tsx` (rewritten)

**Before:**
- Imported `films` from `@/lib/films` (a static in-memory array in `lib/films.ts`)
- Showed `0` seconds and `$0.00` for every film (hardcoded in JSX)

**After:** A **server component** that runs two real DB queries:

**Query 1 — Per-film earnings:**
```sql
SELECT
  films.slug,
  films.title,
  COALESCE(SUM(debit_events.seconds), 0)         AS total_seconds,
  COALESCE(SUM(debit_events.filmmaker_cents), 0) AS total_cents
FROM films
LEFT JOIN playback_sessions ON playback_sessions.film_id   = films.id
LEFT JOIN debit_events      ON debit_events.session_id     = playback_sessions.id
GROUP BY films.id, films.slug, films.title
ORDER BY films.title
```

**Query 2 — Filmmaker pending balances:**
```sql
SELECT name, pending_cents FROM filmmakers ORDER BY name
```

The page then renders:
- **Summary cards** — total seconds watched across all films + total accrued in USD
- **Per-film table** — title, seconds watched, accrued (90% filmmaker share)
- **Filmmaker balances table** — unsettled pending earnings per filmmaker
- **Empty state** — guides user to run `npm run db:seed` if no films found

---

## Files Changed — Full List

| File | Action |
|---|---|
| `lib/db/schema.ts` | Modified — added `accounts` table |
| `lib/auth/password.ts` | **NEW** — PBKDF2-SHA256 password hashing |
| `lib/auth/session.ts` | **NEW** — JWT session management (7-day HttpOnly cookie) |
| `lib/auth/server.ts` | Rewritten — re-exports from session.ts |
| `lib/auth/client.ts` | Rewritten — now a no-op placeholder |
| `lib/auth/sign-in/actions.ts` | Rewritten — DB-backed auth + redirect to `/` |
| `lib/auth/sign-up/actions.ts` | Rewritten — DB-backed registration + redirect to `/` |
| `lib/auth/sign-out/actions.ts` | **NEW** — deletes session cookie, redirects to sign-in |
| `components/nav.tsx` | Rewritten — async server component with live session |
| `components/nav-sign-out.tsx` | **NEW** — client-side form wrapper for sign-out action |
| `app/time/page.tsx` | Rewritten — auth-aware, shows real DB balance |
| `app/studio/page.tsx` | Rewritten — live DB earnings queries |
| `.env` | `AUTH_SECRET` set to a generated secure value |
| `.env.local` | `AUTH_SECRET` set to a generated secure value |

---

## How to Test

1. Open **http://localhost:3001/auth/sign-up**
2. Fill in name, email, and a password (min 8 chars) → click **Create account**
3. You will be redirected to **/** (home page) — films load from the DB
4. The **Nav** shows your live balance (starts at 0) and your display name
5. Click **Time** → see your live balance card with hours/minutes breakdown
6. Click **Studio** → see the earnings table (zeros until playback sessions are recorded)
7. Click **Sign out** → redirected to the sign-in page
8. Sign back in with your email + password → works immediately

---

## Architecture Notes

The auth approach mirrors the **"server-first, cookie-based sessions"** pattern recommended by the Next.js team:

- All auth logic runs on the server (server actions, server components)
- The browser never receives the raw JWT — only reads the cookie indirectly through `httpOnly`
- Password hashes are never sent to the client
- `getSession()` is cheap — only verifies the JWT signature locally, no DB roundtrip needed for basic auth checks
- Balance queries (`users.balanceSeconds`) are separate from auth, keeping concerns clean
