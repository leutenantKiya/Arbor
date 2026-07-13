"use client";

import { useState, useTransition } from "react";
import {
  useAccount,
  useDisconnect,
  useModal,
  useParticleAuth,
} from "@particle-network/connectkit";

// Social connections verify server-side and get a session cookie.
// External-wallet connections are visible but phased (no SIWE yet):
// we catch them, explain, and disconnect — never a silent dead end.
// See docs/AUTH-ARCHITECTURE.md.
export function AuthButton() {
  const { getUserInfo } = useParticleAuth();
  const { disconnectAsync } = useDisconnect();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  const { setOpen } = useModal({
    onConnect: ({ address }) => {
      startTransition(async () => {
        // getUserInfo() only exists for Particle social sessions —
        // it throws for external-wallet connections.
        let info: ReturnType<typeof getUserInfo> | null = null;
        try {
          info = getUserInfo();
        } catch {
          info = null;
        }

        if (!info) {
          // External wallet: phased path, not yet sign-in capable.
          await disconnectAsync();
          setNotice("Wallet sign-in is coming soon — use Google for now.");
          return;
        }

        if (!address) return;
        try {
          const res = await fetch("/api/auth/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uuid: info.uuid,
              token: info.token,
              walletAddress: address,
            }),
          });
          if (!res.ok) throw new Error("verify failed");
          window.location.reload();
        } catch {
          setNotice("Sign-in failed — try again.");
        }
      });
    },
  });

  const { isConnected } = useAccount();

  function handleSignOut() {
    startTransition(async () => {
      await disconnectAsync();
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.reload();
    });
  }

  if (isConnected) {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isPending}
        className="rounded-full bg-cream px-4 py-1.5 text-sm font-medium text-bark transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "Signing out…" : "Sign out"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {notice && <span className="text-xs text-amber-soft">{notice}</span>}
      <button
        type="button"
        onClick={() => {
          setNotice(null);
          setOpen(true);
        }}
        disabled={isPending}
        className="rounded-full bg-cream px-4 py-1.5 text-sm font-medium text-bark transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </div>
  );
}