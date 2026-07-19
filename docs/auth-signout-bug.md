# Auth — Sign Out / Sign In (account switching from same device)

**Date:** 2026-07-20
**Files changed:** `components/auth-button.tsx`, `components/particle-provider.tsx`
**Symptom reported:** "Cannot sign in after signing out" + console
`TypeError: _internal.needRestoreWallet.call is not a function`.

**Requirement (from user):** Sign-out must force a fresh Particle login on next
sign-in, so a *different* account can be used from the same device. Do NOT keep
Particle "silently connected" across a sign-out.

---

## 1. Root cause (two distinct bugs)

### Bug A — disconnectAsync() + no master password = unrecoverable
`handleSignOut()` calls `disconnectAsync()`, which wipes the device's local
MPC-TSS key fragment. Re-login after a key wipe requires Particle's
"restore wallet" flow, which needs a **master password** that was set at first
login. But `particle-provider.tsx` used `promptMasterPasswordSettingWhenLogin: 0`,
so no master password was ever set → `needRestoreWallet()` returns true forever,
the restore modal has nothing to restore, and `runVerifyFlow()` bails before ever
calling `/api/auth/verify`. The user can never sign back in.

### Bug B — `needRestoreWallet?.()` TypeError
The guard `internal.needRestoreWallet?.()` threw
`_internal.needRestoreWallet.call is not a function`. `?.()` only guards
nullish values, NOT a non-callable value — the Particle `_internal` shape exposed
`needRestoreWallet` as a non-function in this SDK version, so the call crashed the
verify flow entirely.

---

## 2. Fixes

### `components/auth-button.tsx`
- `handleSignOut()` keeps `disconnectAsync()` (full Particle disconnect) + the
  `/api/auth/logout` cookie clear + the `SIGNED_OUT_KEY` guard. Sign-out therefore
  forces a fresh Particle login next time — satisfies the account-switching
  requirement.
- The restore guard is now type-safe:
  ```ts
  const needRestore =
    typeof internal.needRestoreWallet === "function"
      ? internal.needRestoreWallet()
      : false;
  if (needRestore) {
    if (typeof internal.openRestoreByMasterPassword === "function") {
      internal.openRestoreByMasterPassword();
    }
    setNotice("Finish the wallet restore, then click Sign in again.");
    return;
  }
  ```
  This removes the TypeError (Bug B) regardless of the unstable `_internal` shape.

### `components/particle-provider.tsx`
- `promptMasterPasswordSettingWhenLogin: 0` → `1`. This makes Particle prompt the
  user to set a master password **once** on first login. That password is what the
  restore flow (triggered after `disconnectAsync()`) needs, so re-login after
  sign-out is now recoverable (fixes Bug A). This is a one-time setup, not a
  per-login prompt.

---

## 3. Resulting flow
1. Sign in (first time) → Particle prompts a master password once → connected,
   server cookie issued.
2. Sign out → `disconnectAsync()` wipes key fragment + cookie cleared. Particle is
   now disconnected.
3. Sign in again → Particle modal shows → user logs in (same or different
   account) → if key fragment was wiped, the restore flow uses the master
   password → `runVerifyFlow` completes → cookie re-issued.

Different accounts from the same device are possible because sign-out fully
disconnects Particle.

---

## 4. Validation / caveats
- `npm run typecheck` passes.
- Behavioral correctness rests on Particle SDK semantics (master-password restore
  after disconnect); not covered by an automated test.
- `disconnectAsync()` is still used in the external-wallet rejection path and the
  dead-session timeout path, so `useDisconnect` remains imported.
