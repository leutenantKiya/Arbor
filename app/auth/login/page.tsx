'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount, useModal } from '@particle-network/connectkit';

// ---------------------------------------------------------------------------
// /auth/login — Particle-first login gate
// ---------------------------------------------------------------------------
// Server components that need auth redirect here instead of /auth/sign-in.
// The page auto-opens the Particle ConnectKit modal.  Once the user is
// connected AND a server session cookie exists (set by AuthButton's
// verify flow), it redirects back to `returnTo` (or `/`).
// ---------------------------------------------------------------------------

export default function ParticleLoginPage() {
  const { setOpen } = useModal();
  const { isConnected } = useAccount();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';
  const opened = useRef(false);

  // Auto-open the Particle modal once on mount.
  useEffect(() => {
    if (!opened.current && !isConnected) {
      opened.current = true;
      // Small delay so ConnectKit has time to mount internally.
      const t = setTimeout(() => setOpen(true), 300);
      return () => clearTimeout(t);
    }
  }, [isConnected, setOpen]);

  // Once the user is connected and the verify flow in AuthButton has set a
  // server cookie, the page will re-render with a session.  We poll /api/auth/me
  // to detect the cookie, then navigate.
  useEffect(() => {
    if (!isConnected) return;

    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch('/api/auth/me');
          const data = await res.json();
          if (data?.user) {
            window.location.href = returnTo;
            return;
          }
        } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 1000));
      }
    };
    void poll();

    return () => { cancelled = true; };
  }, [isConnected, returnTo]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
      <h1 className="font-display text-3xl font-semibold">Sign in to continue</h1>
      <p className="max-w-md text-sage">
        {isConnected
          ? 'Verifying your session…'
          : 'A sign-in window should appear momentarily. If it doesn\u2019t, click below.'}
      </p>
      {!isConnected && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-amber px-6 py-2.5 text-sm font-semibold text-bark transition hover:bg-amber/90"
        >
          Open sign-in
        </button>
      )}
      {isConnected && (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber border-t-transparent" />
      )}
    </div>
  );
}
