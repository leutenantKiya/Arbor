'use client';

import { signOut } from '@/lib/auth/sign-out/actions';

export function NavSignOut() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-full border border-line/60 px-4 py-1.5 text-sm text-sage transition-colors hover:border-cream/40 hover:text-cream"
      >
        Sign out
      </button>
    </form>
  );
}
