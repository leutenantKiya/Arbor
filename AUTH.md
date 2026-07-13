# Arbor Auth System — Technical Reference

> Self-contained email + password authentication using Web Crypto + jose + Drizzle ORM.  
> No external auth service required.

---

## Overview

```
User fills form
      │
      ▼
Server Action (sign-in or sign-up)
      │
      ├─► DB: accounts table (email + passwordHash)
      │
      ├─► crypto.subtle: PBKDF2 verify / hash
      │
      ├─► jose: sign JWT
      │
      └─► Set HttpOnly cookie ──► Redirect to /
                                        │
                              ┌─────────┴──────────┐
                              │   Next.js Request   │
                              │                     │
                              │  getSession()       │
                              │  → jwtVerify()      │
                              │  → { userId, email, │
                              │      name } or null │
                              └─────────────────────┘
```

---

## Files

| File | Role |
|---|---|
| `lib/auth/password.ts` | Hash + verify passwords (PBKDF2) |
| `lib/auth/session.ts` | Create / read / delete JWT sessions |
| `lib/auth/server.ts` | Public server-side exports |
| `lib/auth/sign-in/actions.ts` | Sign-in server action |
| `lib/auth/sign-up/actions.ts` | Sign-up server action |
| `lib/auth/sign-out/actions.ts` | Sign-out server action |
| `lib/db/schema.ts` | `accounts` table definition |

---

## Password Hashing — `lib/auth/password.ts`

Uses **PBKDF2 with SHA-256** via the Web Crypto API (`crypto.subtle`).  
No external libraries. Works in Node.js and the Next.js Edge runtime.

### Hash format stored in DB

```
pbkdf2:100000:<16-byte-salt-as-hex>:<32-byte-hash-as-hex>
```

Example:
```
pbkdf2:100000:a3f1c2d4e5b6a7c8d9e0f1a2b3c4d5e6:9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b
```

### Security properties
- **100,000 PBKDF2 iterations** — tuned for ~100ms on a modern CPU, making brute-force expensive
- **16-byte random salt per password** — prevents rainbow table attacks
- **256-bit derived key** — 32 bytes of output
- **Constant-time comparison** — `verifyPassword` uses XOR loop to prevent timing side-channels

### API

```ts
import { hashPassword, verifyPassword } from '@/lib/auth/password';

// Hash a new password (during sign-up)
const hash = await hashPassword('mysecretpassword');
// → "pbkdf2:100000:a3f1c2...:9a8b7c..."

// Verify on sign-in
const ok = await verifyPassword('mysecretpassword', hash);
// → true
```

---

## Session Management — `lib/auth/session.ts`

Uses **HS256 JWT** via the `jose` library (already in `package.json`).

### Cookie

| Property | Value |
|---|---|
| Name | `arbor-session` |
| HttpOnly | `true` — JS cannot read it |
| Secure | `true` in production, `false` in dev |
| SameSite | `lax` |
| Max age | 7 days (604,800 seconds) |

### JWT Payload

```ts
type SessionPayload = {
  userId: string;   // UUID from accounts table
  email:  string;
  name:   string;
}
```

The `exp` (expiry) and `iat` (issued at) claims are also set automatically by `jose`.

### Signing key

```
process.env.AUTH_SECRET
```

Currently set to `"/O/JEB+y3AaBhh9bq8aURd9/DJEUBZwLDJNJ7bfsebRm"` in `.env` and `.env.local`.

> **Important:** If you rotate this secret, all existing sessions become invalid (users get logged out). Generate a new one with `openssl rand -base64 32`.

### API

```ts
import { createSession, getSession, deleteSession } from '@/lib/auth/server';

// In a server action — after successful login
await createSession({ userId, email, name });

// In any server component or server action — check who is logged in
const session = await getSession();
if (!session) redirect('/auth/sign-in');
console.log(session.userId, session.email, session.name);

// In the sign-out action
await deleteSession();
```

---

## Database — `accounts` Table

Defined in `lib/db/schema.ts`:

```ts
export const accounts = pgTable(
  "accounts",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    email:        text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name:         text("name").notNull().default(""),
    walletAddress: text("wallet_address").notNull()
                   .default("0x0000000000000000000000000000000000000000"),
    createdAt:    timestamp("created_at", { withTimezone: true })
                   .notNull().defaultNow(),
  },
  (t) => [uniqueIndex("accounts_email_unique").on(t.email)],
);
```

### Relationship to `users` table

The existing `users` table (used for the ledger / balance) uses `particleUuid` as the foreign identity key. It is **separate** from `accounts`. In the current implementation:

- `accounts` — auth identity (email + password)
- `users` — ledger identity (wallet + time balance)

Future work will link them: when a user first signs in and connects their wallet, an entry in `users` will be created and the `userId` from `accounts` will be used as the foreign key.

---

## Sign-In Flow — Step by Step

```
POST /auth/sign-in (form submit)
  │
  ▼
signInWithEmail(formData) [server action]
  │
  ├── email  = formData.get('email').trim().toLowerCase()
  ├── password = formData.get('password')
  │
  ├── SELECT * FROM accounts WHERE email = ? LIMIT 1
  │       └── Not found? → return { error: 'Invalid email or password.' }
  │
  ├── verifyPassword(password, account.passwordHash)
  │       └── Wrong? → return { error: 'Invalid email or password.' }
  │
  ├── createSession({ userId: account.id, email, name: account.name })
  │       └── Signs JWT → sets HttpOnly cookie
  │
  └── redirect('/')
```

---

## Sign-Up Flow — Step by Step

```
POST /auth/sign-up (form submit)
  │
  ▼
signUpWithEmail(formData) [server action]
  │
  ├── name     = formData.get('name').trim()
  ├── email    = formData.get('email').trim().toLowerCase()
  ├── password = formData.get('password')
  │
  ├── Validate: all fields present, password >= 8 chars
  │
  ├── SELECT id FROM accounts WHERE email = ? LIMIT 1
  │       └── Exists? → return { error: 'An account with that email already exists.' }
  │
  ├── hashPassword(password) → passwordHash
  │
  ├── INSERT INTO accounts (name, email, password_hash) VALUES (...)
  │
  ├── createSession({ userId: account.id, email, name })
  │
  └── redirect('/')
```

---

## Sign-Out Flow

```
User clicks "Sign out"
  │
  ▼
NavSignOut component (client) submits form
  │
  ▼
signOut() [server action]
  │
  ├── deleteSession() → clears 'arbor-session' cookie
  │
  └── redirect('/auth/sign-in')
```

---

## Using Auth in Server Components

```tsx
// Any server component (page, layout, etc.)
import { getSession } from '@/lib/auth/server';

export default async function MyPage() {
  const session = await getSession();

  if (!session) {
    // User is not logged in
    return <p>Please sign in.</p>;
  }

  // session.userId, session.email, session.name are available
  return <p>Hello, {session.name}!</p>;
}
```

---

## Using Auth in Server Actions

```ts
'use server';
import { getSession } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export async function someProtectedAction() {
  const session = await getSession();
  if (!session) redirect('/auth/sign-in');

  // session.userId is now guaranteed to be a valid UUID
  // do protected work...
}
```

---

## What Was Removed

The following packages/modules are **no longer actively used** by the auth system:

| Item | Status |
|---|---|
| `@neondatabase/neon-js/auth/next` | Import removed from `lib/auth/client.ts` |
| `@neondatabase/neon-js/auth/next/server` | Import removed from `lib/auth/server.ts` |
| `createNeonAuth()` | Replaced by `createSession / getSession` |
| `createAuthClient()` | Replaced by server-component session reads |
| `NEON_AUTH_BASE_URL` env var | No longer read by any code |
| `NEON_AUTH_COOKIE_SECRET` env var | No longer read by any code |

The `@neondatabase/neon-js` package remains installed (in `node_modules`) — it just isn't imported anymore. It can be removed from `package.json` when convenient.
