"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useDisconnect,
  useModal,
  useSmartAccount,
} from "@particle-network/connectkit";
import { ProfileDialog } from "./profile-dialog";

// ---------------------------------------------------------------------------
// Design notes (read before touching this file)
// ---------------------------------------------------------------------------
// 1. ConnectKit's own <ConnectModal> calls `setOpen(false)` inside a
//    useEffect that fires whenever `isConnected` changes.  That means
//    the modal auto-closes the moment Particle reports "connected".
//    For Google/Apple OAuth this is fine (auth finishes on redirect).
//    For email OTP this is fine too — `isConnected` only flips after the
//    full email→code→wallet flow completes internally.
//
// 2. disconnectAsync() wipes the local MPC-TSS key fragment, which
//    means Particle may prompt "Restore your wallet" on next login.
//    We call it on explicit sign-out (user expects a full logout) but
//    NEVER during the login flow (that would kill an in-progress auth).
//
// 3. getUserInfo() reads from window.particle._internal which may not
//    exist until auth-core finishes initializing (especially after an
//    OAuth redirect). We poll the global directly — the useParticleAuth()
//    hook memoizes a stale null and never recovers.
// 4. After sign-out we set a sessionStorage flag so the auto-verify
//    effect doesn't immediately re-login the user (Particle stays
//    connected to preserve MPC keys). The flag is cleared when the
//    user explicitly clicks "Sign in".
// 5. On successful verify we default to router.refresh() — it re-fetches
//    the Nav (and current page) as Server Components without unmounting
//    any client component, so Particle/ConnectKit state survives (unlike
//    a full navigation). Visually only the navbar changes on most routes.
//    The one exception is /studio for a filmmaker: that page's entire body
//    (CreatorApplicationView vs FilmmakerDashboard, plus the one-time
//    ensureFilmmakerRecord provisioning) is decided server-side from
//    scratch, so it gets a full reload instead of a soft refresh.
// ---------------------------------------------------------------------------

const SIGNED_OUT_KEY = "arbor_signed_out";

type ParticleInternal = {
  getUserInfo?: () => { uuid: string; token: string } | null;
  needRestoreWallet?: () => boolean;
  openRestoreByMasterPassword?: () => void;
};

function particleInternal(): ParticleInternal | null {
  const w = window as unknown as {
    particle?: { _internal?: ParticleInternal };
  };
  return w.particle?._internal ?? null;
}

export function AuthButton({
  hasSession,
  initialBalanceSeconds = 0,
  initialSocialId = "",
}: {
  hasSession: boolean;
  initialBalanceSeconds?: number;
  initialSocialId?: string;
}) {
  const router = useRouter();
  const { disconnectAsync } = useDisconnect();
  const { isConnected, address, connector } = useAccount();
  const { setOpen } = useModal();
  const smartAccount = useSmartAccount();

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // One verify attempt per connection — StrictMode double-mount and
  // re-renders must not stack requests.
  const verifyingRef = useRef(false);

  // ------------------------------------------------------------------
  // Core verify flow — called only when Particle is fully connected
  // AND we don't yet have a server session cookie.
  // ------------------------------------------------------------------
  async function runVerifyFlow(currentAddress: string) {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setBusy(true);
    // Running verify IS the explicit sign-in action (whether triggered by the
    // nav "Sign in" button, the auto-verify effect after a fresh connect, or
    // the /auth/login gate after "Start watching"/"Play"). Clear the
    // post-sign-out guard here so a prior sign-out never blocks THIS login.
    // (Previously the guard was only cleared in handleSignIn, so the
    // auto-verify effect stayed blocked after sign-out → runVerifyFlow never
    // ran → no /api/auth/verify POST → session cookie never set → stuck on
    // the login gate with no console error.)
    try {
      sessionStorage.removeItem(SIGNED_OUT_KEY);
    } catch {
      /* ignore */
    }

    try {
      // Resolve the Smart Account address so we record it in the DB instead of the EOA address
      let verifiedAddress = currentAddress;
      if (smartAccount) {
        verifiedAddress = await smartAccount.getAddress();
      }
      // ── External wallet? ──────────────────────────────────────────
      const connectorType = (
        connector as unknown as { walletConnectorType?: string }
      )?.walletConnectorType;
      if (connectorType !== undefined && connectorType !== "particleAuth") {
        await disconnectAsync();
        setNotice("Wallet sign-in is coming soon — use Google/Email for now.");
        return;
      }

      // ── Wait for window.particle._internal AND a non-null userInfo ─
      // Two distinct races share this loop:
      //  - OAuth redirect: auth-core takes a few seconds to init, so
      //    _internal itself appears late.
      //  - Email OTP (no redirect): _internal already exists, but
      //    `isConnected` flips a beat BEFORE auth-core writes userInfo,
      //    so an immediate getUserInfo() returns null on a healthy
      //    session. Polling only for _internal's existence made every
      //    email login look "expired" — userInfo must be polled too.
      let info: { uuid: string; token: string } | null = null;
      for (let attempt = 0; attempt < 40 && !info; attempt++) {
        const internal = particleInternal();
        if (internal) {
          // disconnectAsync() on sign-out wipes the local MPC key fragment
          // (see note 2 above) — the very next login on THIS device then
          // needs the master-password restore flow before getUserInfo()
          // can ever return anything. Without this check the loop below
          // just times out, disconnects again, and the restore requirement
          // never clears — every subsequent login repeats the same 20s
          // dead-end forever. Regression history: this check has been
          // dropped twice already by unrelated rewrites of this file
          // (see git blame) — do not remove it again without replacing it.
          //
          // NOTE: the Particle _internal shape is unstable across SDK
          // versions — needRestoreWallet is sometimes a non-callable value,
          // so `internal.needRestoreWallet?.()` throws
          // "call is not a function". Guard with typeof before calling.
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
          try {
            info = internal.getUserInfo?.() ?? null;
          } catch {
            // auth-core still initializing — keep polling
          }
        }
        if (!info) await new Promise((r) => setTimeout(r, 500));
      }

      if (!info) {
        // 20s with a connected wallet but no user info → genuinely dead.
        await disconnectAsync();
        setNotice("Session expired — click Sign in to log in again.");
        return;
      }

      // ── Verify server-side ────────────────────────────────────────
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuid: info.uuid,
          token: info.token,
          walletAddress: verifiedAddress,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`verify ${res.status}: ${body.slice(0, 200)}`);
      }

      const { isFilmmaker } = (await res.json()) as { isFilmmaker: boolean };

      // /studio's entire body is decided server-side by filmmaker status —
      // a soft refresh won't swap CreatorApplicationView for
      // FilmmakerDashboard, so that one route needs a full reload.
      if (isFilmmaker && window.location.pathname === "/studio") {
        window.location.href = window.location.pathname;
        return;
      }

      // Refresh Server Components (Nav picks up the new session) without
      // unmounting client components — Particle/ConnectKit state survives,
      // unlike a full navigation.
      router.refresh();
    } catch (err) {
      console.error("[AuthButton] verify flow failed:", err);
      setNotice("Sign-in failed — try again.");
    } finally {
      verifyingRef.current = false;
      setBusy(false);
    }
  }

  // ------------------------------------------------------------------
  // Trigger: connected + no server session → verify.
  // ConnectKit already closes the modal for us when isConnected flips.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isConnected || !address || hasSession) return;
    // A fresh Particle connection with no server session = a deliberate
    // sign-in (via the nav "Sign in" button OR the /auth/login gate after
    // "Start watching"/"Play"). Clear the post-sign-out guard here so it can
    // never block THIS login.
    //
    // Why here and not only in runVerifyFlow: sign-out now calls
    // disconnectAsync(), so Particle is disconnected after sign-out and
    // isConnected stays false until the user explicitly reconnects. The
    // effect therefore cannot fire spuriously, so clearing the flag on a
    // genuine new connection is safe. Clearing it ONLY inside runVerifyFlow
    // was a bug — the guard below returned BEFORE runVerifyFlow ever ran, so
    // the play-gate path (which relies on this auto-verify effect) was
    // permanently blocked after any prior sign-out: no POST /api/auth/verify,
    // stuck on the login gate.
    try {
      sessionStorage.removeItem(SIGNED_OUT_KEY);
    } catch {
      /* ignore */
    }
    void runVerifyFlow(address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, hasSession]);

  // ------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------
  function handleSignIn() {
    setNotice(null);
    sessionStorage.removeItem(SIGNED_OUT_KEY);
    // Particle can already be connected here (e.g. the previous verify
    // attempt failed without disconnecting — see the generic catch in
    // runVerifyFlow) while we still have no server session. Reopening the
    // connect modal does nothing in that case — ConnectKit has no fresh
    // OAuth step to run since it already considers the wallet connected —
    // so the "Sign in" button would look like a dead end. Retry the verify
    // directly instead; only fall back to the modal when truly disconnected.
    if (isConnected && address) {
      void runVerifyFlow(address);
      return;
    }
    setOpen(true);
  }

  function handleSignOut() {
    setBusy(true);
    sessionStorage.setItem(SIGNED_OUT_KEY, "1");
    // Fully disconnect Particle (wipes the local MPC key fragment) AND clear
    // the server session cookie, so the next sign-in must go through the
    // Particle login modal again — required for switching accounts from the
    // same device. The SIGNED_OUT_KEY guard stops the auto-verify effect from
    // immediately re-logging-in while signed out.
    Promise.all([
      disconnectAsync().catch(() => {}),
      fetch("/api/auth/logout", { method: "POST" }),
    ]).finally(() => {
      window.location.href = window.location.pathname;
    });
  }

  if (isConnected && hasSession) {
    return (
      <ProfileDialog
        walletAddress={address ?? ""}
        onSignOut={handleSignOut}
        busy={busy}
        initialBalanceSeconds={initialBalanceSeconds}
        initialSocialId={initialSocialId}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      {notice && <span className="text-xs text-amber-soft">{notice}</span>}
      <button
        type="button"
        onClick={handleSignIn}
        disabled={busy}
        className="rounded-full bg-cream px-4 py-1.5 text-sm font-medium text-bark transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </div>
  );
}
