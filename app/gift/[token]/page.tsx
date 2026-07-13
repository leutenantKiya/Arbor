// Day-1 shell: gift claiming lands day 5 (balance-funded, single-use tokens).
export default async function GiftClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await params;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl">🎁</p>
      <h1 className="mt-4 font-display text-3xl font-semibold">
        Someone sent you cinema
      </h1>
      <p className="mt-3 text-sage">
        Sign in with Google and the viewing time lands in your balance —
        no wallet, no setup, no strings.
      </p>
      <button
        type="button"
        disabled
        className="mt-8 cursor-not-allowed rounded-full bg-cream/10 px-8 py-2.5 text-sm text-sage"
        title="Claiming opens once sign-in is wired"
      >
        Continue with Google
      </button>
    </div>
  );
}
