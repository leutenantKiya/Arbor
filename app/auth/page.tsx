import Link from 'next/link';

export default function AuthRootPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center text-cream">
      <h1 className="text-4xl font-semibold">Welcome to Arbor</h1>
      <p className="mt-4 text-slate-300">
        Sign in to play films and let the app proof the database is working.
      </p>
      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
        <Link
          href="/auth/sign-in"
          className="rounded-full bg-amber px-6 py-3 text-sm font-semibold text-bark"
        >
          Sign in
        </Link>
        <Link
          href="/auth/sign-up"
          className="rounded-full border border-cream/30 px-6 py-3 text-sm text-cream"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
