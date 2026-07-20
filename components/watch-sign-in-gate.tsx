'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from '@particle-network/connectkit';

const COUNTDOWN_SECONDS = 5;

// Shown by /watch/[slug] to signed-out viewers. This route is query-string
// free, so the nav "Sign in" (top-right) works here — if the user signs in,
// Particle connects, the nav AuthButton verifies + router.refresh()es, and
// this server route re-renders straight into the player (this gate unmounts).
// If they do nothing, a countdown sends them to a CLEAN home URL to sign in.
// (Never redirect to "/?something" — a query string breaks Google OAuth,
// docs/playback-particle-auth.md §9.)
export function WatchSignInGate({ filmTitle }: { filmTitle: string }) {
  const { isConnected } = useAccount();
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    // Sign-in underway (Particle connected) — hold the countdown; the nav
    // AuthButton is about to re-render this route into the player. Redirecting
    // now would abort that and bounce the user away mid-sign-in.
    if (isConnected) return;
    if (seconds <= 0) {
      window.location.href = '/';
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, isConnected]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center">
        <h1 className="font-display text-2xl font-semibold">Sign in to watch</h1>
        <p className="mt-3 text-sm leading-relaxed text-sage">
          You need to be signed in to watch{' '}
          <span className="text-cream">{filmTitle}</span>. Use the{' '}
          <span className="text-amber">Sign in</span> button in the top-right
          corner&nbsp;↗
        </p>

        {isConnected ? (
          <div className="mt-7 flex items-center justify-center gap-2 font-mono text-xs text-sage">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber border-t-transparent" />
            Signing you in…
          </div>
        ) : (
          <>
            <p className="mt-7 font-mono text-xs text-ink-faint">
              Redirecting to the home page in{' '}
              <span className="tabular-nums text-sage">{seconds}s</span>…
            </p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-full border border-line px-4 py-2 font-mono text-xs text-sage transition-colors hover:border-cream/40 hover:text-cream"
            >
              Go to the home page now
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
