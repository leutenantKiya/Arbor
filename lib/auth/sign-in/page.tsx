'use client';

import { useActionState } from 'react';
import { signInWithEmail } from './actions';

export default function SignInForm() {
  const [state, formAction, isPending] = useActionState(signInWithEmail, null);

  return (
    <form
      action={formAction}
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-gray-900"
    >
      <h1 className="text-2xl font-bold text-white">Sign in to your account</h1>

      <label className="flex w-sm flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-100">Email</span>
        <input name="email" type="email" required
          className="rounded-md bg-white/5 px-2 py-1.5 text-white outline-1 outline-white/10" />
      </label>
      <label className="flex w-sm flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-100">Password</span>
        <input name="password" type="password" required
          className="rounded-md bg-white/5 px-2 py-1.5 text-white outline-1 outline-white/10" />
      </label>

      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}

      <button type="submit" disabled={isPending}
        className="w-sm rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-400">
        {isPending ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}