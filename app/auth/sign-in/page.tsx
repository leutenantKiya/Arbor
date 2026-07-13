'use client';

import { useActionState } from 'react';
import { signInWithEmail } from '@/lib/auth/sign-in/actions';

export default function SignInPage() {
  const [state, formAction, isPending] = useActionState(signInWithEmail, null);

  return (
    <form
      action={formAction}
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-gray-900 text-white"
    >
      <h1 className="text-3xl font-semibold">Sign in to Arbor</h1>

      <label className="flex w-full max-w-md flex-col gap-2">
        <span className="text-sm text-gray-200">Email</span>
        <input
          name="email"
          type="email"
          required
          className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-amber"
        />
      </label>

      <label className="flex w-full max-w-md flex-col gap-2">
        <span className="text-sm text-gray-200">Password</span>
        <input
          name="password"
          type="password"
          required
          className="rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-amber"
        />
      </label>

      {state?.error && (
        <p className="max-w-md text-left text-sm text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full max-w-md rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-bark transition hover:bg-amber/90"
      >
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-sm text-slate-300">
        No account yet?{' '}
        <a href="/auth/sign-up" className="text-amber underline">
          Create one
        </a>
      </p>
    </form>
  );
}
