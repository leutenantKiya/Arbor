const packages = [
  { id: "sprout", hours: 2.5, price: "$2.49", note: "A film night" },
  { id: "sapling", hours: 5, price: "$4.49", note: "Most popular", popular: true },
  { id: "grove", hours: 10, price: "$7.99", note: "A festival at home" },
];

// Day-1 shell: purchase wiring lands day 3 (Particle gasless → ArborVault).
export default function TimePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 pb-20 pt-14">
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        Your time
      </h1>
      <p className="mt-2 text-sage">
        Time is only used while a film is playing. Browsing, trailers, and
        pausing are always free. Your balance never runs out on its own.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {packages.map((p) => (
          <div
            key={p.id}
            className={`rounded-card border p-6 ${
              p.popular
                ? "border-amber/50 bg-surface-2"
                : "border-line bg-surface"
            }`}
          >
            {p.popular && (
              <p className="mb-2 text-xs uppercase tracking-widest text-amber">
                Most popular
              </p>
            )}
            <p className="font-display text-3xl font-semibold">
              {p.hours} hours
            </p>
            <p className="mt-1 text-sage">{p.note}</p>
            <p className="mt-4 text-2xl text-amber-soft">{p.price}</p>
            <button
              type="button"
              disabled
              className="mt-6 w-full cursor-not-allowed rounded-full bg-cream/10 py-2.5 text-sm text-sage"
              title="Purchases open once sign-in is wired (day 3)"
            >
              Sign in to add time
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
