# Auth — Removed Mock Sign-In, Playback Now Uses Particle

**Date:** 2026-07-20
**Files changed:**
- `app/watch/[slug]/page.tsx` — gate now redirects to Particle login
- Deleted: `app/auth/sign-in/` (page + `lib/auth/sign-in/actions.ts`),
  `app/auth/sign-up/` (page + `lib/auth/sign-up/actions.ts`),
  `lib/auth/password.ts`, `app/auth/page.tsx`
- Comment cleanup in `app/time/page.tsx`, `app/auth/login/page.tsx`

**Requirement:** Playback ("Start watching" hero button + film "▶ Play") must require
Particle sign-in, not the old mock email/password form. Remove the mock auth code
since the app has migrated to Particle.

---

## 1. Confirmation of the bug

The hero "Start watching" (`app/page.tsx`) and film-detail "▶ Play"
(`app/film/[slug]/page.tsx`) both link to `/watch/<slug>`. That page did:

```ts
if (!session) redirect('/auth/sign-in');
```

`/auth/sign-in` was the **mock** email/password page
(`app/auth/sign-in/page.tsx` → `lib/auth/sign-in/actions.ts` → `accounts` table).
It was NOT Particle. A proper Particle gate already existed at `/auth/login`
(`app/auth/login/page.tsx`) which auto-opens the ConnectKit modal and polls
`/api/auth/me` for the session, then redirects to `returnTo`. The watch flow simply
wasn't using it.

`/api/auth/me` was verified present and correct: returns `{ user: null }` when no
session, `{ user: { id, balanceSeconds, walletAddress } }` when valid.

---

## 2. Changes

### `app/watch/[slug]/page.tsx`
```ts
const { slug } = await params;
const session = await getSession();
if (!session) redirect(`/auth/login?returnTo=/watch/${slug}`);
```
- `slug` is now resolved before the guard (fixes a "used before declaration" TS
  error).
- Only the **watch** flow redirects to `/auth/login?returnTo=/watch/<slug>`. Other
  Particle-triggered redirects (nav AuthButton, /time AuthButton) keep their own
  `returnTo` and are unaffected — we did NOT globally repoint every Particle
  instance to the watch page.

### Mock code removed
- `app/auth/sign-in/` — mock sign-in page + server action
- `app/auth/sign-up/` — mock sign-up page + server action
- `lib/auth/password.ts` — PBKDF2 hash/verify (only used by the mock)
- `app/auth/page.tsx` — the `/auth` landing page that linked to the mock pages

### Kept (intentionally)
- `/api/auth/me` — used by the Particle gate.
- `accounts` table + `users.accountId` in `lib/db/schema.ts` + the `accountId`
  reads in `app/studio/settings/page.tsx` and `lib/db/functions.sql`. These are DB
  schema/data and were left in place to avoid an unrequested migration/data risk;
  they are simply no longer written to by any sign-in flow. The mock *UI/action*
  code is what was removed.
- `app/auth/login/page.tsx` — the Particle gate (now the only `/auth/*` route).

---

## 3. Resulting flow
1. Signed-out user clicks "Start watching" / "▶ Play" → `/watch/<slug>`.
2. No session → `redirect('/auth/login?returnTo=/watch/<slug>')`.
3. Particle ConnectKit modal opens → user logs in with Google/email →
   AuthButton's verify flow sets the session cookie.
4. `/auth/login` polls `/api/auth/me`, sees the cookie, redirects to
   `/watch/<slug>` → playback begins.

No mock email/password path remains in the UI.

---

## 4. Caveats
- Dead mock references remain only in **docs** (AUTH.md, CHANGES.md,
  SESSION_BILLING.md) — left as-is; not code.
- `accounts` table is now unwritten but retained; a follow-up cleanup (and possible
  `drizzle-kit` migration) could drop it if desired, but that was out of scope.
- `npm run typecheck` passes. No automated test covers the gate redirect.

## 5. Follow-up fix — "Request failed" on the watch gate (post-verify race)
**Symptom:** Clicking "Start watching"/"Play" → Particle login → `POST /api/auth/verify`
returns **200** (cookie set correctly) but the UI shows a generic "Request failed"
and never lands on the film.

**Root cause:** two owners of "complete sign-in" fired at once after the 200:
1. `runVerifyFlow` (nav `AuthButton`) called `router.refresh()` (soft navigation).
2. `/auth/login` page's `/api/auth/me` poll detected the new cookie and did
   `window.location.href = returnTo` (full navigation).
The two navigations raced; the interrupted one surfaced as the generic failure
even though verification fully succeeded. (The ~14s verify duration is just the
Particle RPC + DB being slow on first login — unrelated to the failure.)

**Fix:** `runVerifyFlow` now skips `router.refresh()` when
`window.location.pathname` starts with `/auth/login`, letting the gate's poll own
the redirect to `returnTo`. Everywhere else keeps the soft refresh.

## 6. Real fix — "Request failed" happens INSIDE the Particle modal (pre-verify)
**Date:** 2026-07-20
**Symptom:** nav/`/time` "Sign in" works, but reaching the modal via the play
gate (`Start watching` / `Play` → `/watch` → `/auth/login?returnTo=…`) fails with
Particle's generic **"Request failed"** in the modal — *before* any
`/api/auth/verify` fires. So §5 (a post-verify navigation race) was NOT the whole
story; that only explained a failure after a 200.

**Root cause:** Particle Auth captures the **current page URL** when it starts
social OAuth (Google/Apple redirect away and back). The nav button initiates from
a clean URL (`/`, `/time`) — works. The gate initiates from
`/auth/login?returnTo=/watch/<slug>`; that extra query param on the OAuth
return URL breaks Particle's connect completion → "Request failed". The query
param was the *only* structural difference between the two flows.

**Fix (`app/auth/login/page.tsx`):** on mount, move `returnTo` out of the URL
into `sessionStorage` and `history.replaceState` to a bare `/auth/login`, so the
gate's OAuth round-trip is identical to the working nav flow (clean URL). The
post-connect poll reads the destination from `sessionStorage` (same-origin
validated against open-redirect). `app/watch/[slug]/page.tsx` now
`encodeURIComponent`s the `returnTo` value (hygiene).

**If it still fails:** capture the exact modal text + the Network tab at the
moment of failure (is a request to `*.particle.network` red? what status?) — that
distinguishes a connect-init failure from an OAuth-return failure.

## 7. ACTUAL root cause — the gate must NOT live under `/auth`
**Date:** 2026-07-20
The §5/§6 fixes were necessary but did not cure it. Live testing pinned it down:

- Signed-out, a fresh Google login from the **nav** "Sign in" on `/` (and `/time`)
  **works**.
- The **play gate** at `/auth/login` fails with "Request failed" **immediately —
  the Google account screen never opens** (so it's a connect-*init* failure, not
  an OAuth-return race).
- It **still fails after a full F5 reload** of `/auth/login` (so it is not
  soft-navigation staleness).
- No middleware / CSP / header in this app special-cases `/auth`. `/time` renders
  two AuthButtons (two ConnectKit consumers) and works, so it isn't a
  multiple-consumer conflict either.

**Conclusion:** Particle's ConnectKit refuses to *start* a social/email login when
it is initiated from a route under **`/auth`** — Particle treats `/auth/*` as an
OAuth-callback path. The only variable that distinguished the broken gate from the
working nav was the route path.

**Fix:**
- Moved the gate to **`app/continue/page.tsx`** (identical logic).
- `app/watch/[slug]/page.tsx` now redirects to `/continue?returnTo=…`.
- `components/auth-button.tsx` `onLoginGate` check → `/continue`.
- `app/auth/login/page.tsx` is now a server redirect to `/continue` (keeps old
  links working; bounces before Particle mounts).

**Rule:** never initiate a Particle login from a route under `/auth`. Keep the
gate on a normal path.

## 8. FINAL resolution — no dedicated gate page at all
**Date:** 2026-07-20
Moving the gate to `/continue` (a non-`/auth` path) **also failed** with the same
immediate "Request failed". So it is not the `/auth` path specifically — the
pattern is: **Particle connect fails when initiated from a bare, dedicated gate
page, but works from the nav "Sign in" on a real content page (`/`, `/time`).**
The precise Particle-side reason is unresolved, but the behavior is consistent
and reproducible.

**Resolution (what actually ships):** stop using a dedicated gate. A signed-out
viewer who clicks "Start watching" / "Play" is redirected to **`/?signin=1`**
(home), which shows a small banner (`components/sign-in-notice.tsx`) pointing at
the working nav "Sign in" button. The user signs in there (works), then reopens
the film. We do NOT auto-continue to the film and we do NOT auto-open the modal
(no-gesture opens fail).

- `app/watch/[slug]/page.tsx`: signed-out → `redirect('/?signin=1')`.
- `components/sign-in-notice.tsx`: the home banner.
- `app/page.tsx`: renders `<SignInNotice />`.
- `app/continue/page.tsx` + `app/auth/login/page.tsx` are now **unused** (kept as
  harmless dead routes; safe to delete later).

**Open item (nice-to-have):** auto-return to the film after sign-in could be
added safely by stashing the target in sessionStorage and letting the WORKING
`/time` (or nav) sign-in complete, then redirecting — the failure was always at
connect-*init* on a gate page, never in a post-sign-in redirect. Deferred.

## 9. THE ACTUAL ROOT CAUSE — a query string on the URL breaks Google sign-in
**Date:** 2026-07-20
A clean controlled test finally isolated it: on the SAME page (`/`), Google
sign-in **works at `http://localhost:3000/`** but **fails at
`http://localhost:3000/?signin=1`** — same path, the only difference is the query
string. Email OTP works in both.

**Root cause:** Particle's social login does a full-page OAuth redirect and uses
the current page URL (including `location.search`) as the return/redirect target.
A query string on that URL breaks the OAuth init → immediate "Request failed", no
Google screen. Email OTP does no OAuth redirect, so it is unaffected.

This retroactively explains EVERY failure in §5–§8: they all initiated OAuth from
a URL carrying a query param (`?returnTo=…`, `?signin=1`). The path (`/auth` vs
`/continue`) and the "gate page" framing were red herrings — the common factor was
always the query string. (The §6 clean-URL attempt on the gate didn't stick,
likely a strip-timing issue; the reliable answer is to never put a query there in
the first place.)

**Rule:** initiate Particle Google/social sign-in only from a **query-string-free
URL**. Never redirect a to-be-authed user to `…?anything`.

**Fix that ships:** signed-out `/watch/[slug]` renders `WatchSignInGate`
(`components/watch-sign-in-gate.tsx`): a warning that points at the nav "Sign in"
(top-right) plus a 5s countdown that then sends the user to a CLEAN `/` (no query).
Because `/watch/<slug>` is itself query-free, the user can just sign in from the
gate via the nav — Google works there — and `useAccount().isConnected` pauses the
countdown while the nav AuthButton verifies and `router.refresh()`es this route
straight into the player (the gate unmounts). No dedicated login route, no query
string anywhere. The earlier `?signin=1` banner (`components/sign-in-notice.tsx`)
was removed — it reintroduced a query and re-broke Google.

**Rule reminder:** the redirect target and the sign-in page must both be
query-string-free. Any "hint" must be carried out-of-band (cookie/sessionStorage),
never as `?…`.
