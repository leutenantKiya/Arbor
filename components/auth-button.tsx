"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAccount,
  useDisconnect,
  useModal,
} from "@particle-network/connectkit";

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
// ---------------------------------------------------------------------------

const SIGNED_OUT_KEY = "arbor_signed_out";

type ParticleInternal = {
  getUserInfo?: () => { uuid: string; token: string } | null;
};

function particleInternal(): ParticleInternal | null {
  const w = window as unknown as {
    particle?: { _internal?: ParticleInternal };
  };
  return w.particle?._internal ?? null;
}

export function AuthButton({ hasSession }: { hasSession: boolean }) {
  const { disconnectAsync } = useDisconnect();
  const { isConnected, address, connector } = useAccount();
  const { setOpen } = useModal();

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

    try {
      // ── External wallet? ──────────────────────────────────────────
      const connectorType = (
        connector as unknown as { walletConnectorType?: string }
      )?.walletConnectorType;
      if (connectorType !== undefined && connectorType !== "particleAuth") {
        await disconnectAsync();
        setNotice("Wallet sign-in is coming soon — use Google/Email for now.");
        return;
      }

      // ── Wait for window.particle._internal ────────────────────────
      // After OAuth redirect auth-core can take a few seconds to init.
      let internal: ParticleInternal | null = null;
      for (let attempt = 0; attempt < 40 && !internal; attempt++) {
        internal = particleInternal();
        if (!internal) await new Promise((r) => setTimeout(r, 500));
      }

      if (!internal) {
        setNotice("Still connecting — give it a moment and click Sign in.");
        return;
      }

      // ── Get user info ─────────────────────────────────────────────
      let info: { uuid: string; token: string } | null = null;
      try {
        info = internal.getUserInfo?.() ?? null;
      } catch (err) {
        console.error("[AuthButton] getUserInfo threw:", err);
      }

      if (!info) {
        // auth-core initialized but no user → session genuinely dead.
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
          walletAddress: currentAddress,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`verify ${res.status}: ${body.slice(0, 200)}`);
      }

      // Soft navigation — full reload would re-trigger Particle churn.
      window.location.href = window.location.pathname;
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
    // Don't auto-verify after an intentional sign-out.
    if (sessionStorage.getItem(SIGNED_OUT_KEY)) return;
    void runVerifyFlow(address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, hasSession]);

  // ------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------
  function handleSignIn() {
    setNotice(null);
    sessionStorage.removeItem(SIGNED_OUT_KEY);
    setOpen(true);
  }

  function handleSignOut() {
    setBusy(true);
    sessionStorage.setItem(SIGNED_OUT_KEY, "1");
    // Fully disconnect Particle + clear server session so next
    // sign-in shows the modal fresh.
    Promise.all([
      disconnectAsync().catch(() => {}),
      fetch("/api/auth/logout", { method: "POST" }),
    ]).finally(() => {
      window.location.href = window.location.pathname;
    });
  }

  if (isConnected && hasSession) {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        disabled={busy}
        className="rounded-full bg-cream px-4 py-1.5 text-sm font-medium text-bark transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
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
