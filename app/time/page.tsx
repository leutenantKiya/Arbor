import { AuthButton } from '@/components/auth-button';
import { PurchaseButton } from '@/components/purchase-button';
import { getSession } from '@/lib/auth/server';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const packages = [
  { id: "sprout", hours: 2.5, seconds: 9000, cents: 249, price: "$2.49", note: "A film night" },
  { id: "sapling", hours: 5, seconds: 18000, cents: 449, price: "$4.49", note: "Most popular", popular: true },
  { id: "grove", hours: 10, seconds: 36000, cents: 799, price: "$7.99", note: "A festival at home" },
];

function formatBalance(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default async function TimePage() {
  const session = await getSession();

  let balanceSeconds: number | null = null;
  if (session) {
    const [user] = await db
      .select({ balanceSeconds: users.balanceSeconds })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    balanceSeconds = user?.balanceSeconds ?? 0;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 pb-20 pt-14">
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        Your time
      </h1>
      <p className="mt-2 text-sage">
        Time is only used while a film is playing. Browsing, trailers, and
        pausing are always free. Your balance never runs out on its own.
      </p>

      {/* Balance card */}
      {session && (
        <div className="mt-8 rounded-card border border-amber/30 bg-surface-2 p-6">
          <p className="text-sm uppercase tracking-widest text-amber">
            Current balance
          </p>
          <p className="mt-2 font-display text-4xl font-semibold tabular-nums">
            {balanceSeconds !== null ? formatBalance(balanceSeconds) : '—'}
          </p>
          <p className="mt-1 text-sm text-sage">
            {session.email}
          </p>
        </div>
      )}

      {!session && (
        <div className="mt-8 rounded-card border border-line/60 bg-surface p-6 text-center">
          <p className="text-sage">
            Sign in to see your balance and add viewing time.
          </p>
          {/* One auth system only: Particle via the nav button
              (docs/AUTH-ARCHITECTURE.md) — /auth/sign-in is the parked
              password path and must not be linked from the UI. */}
          <div className="mt-4 flex justify-center">
            <AuthButton hasSession={false} />
          </div>
        </div>
      )}

      {/* Packages */}
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
            {session ? (
              <PurchaseButton
                packageId={p.id}
                price={p.price}
                cents={p.cents}
                seconds={p.seconds}
              />
            ) : (
              <p className="mt-6 w-full rounded-full bg-cream/10 py-2.5 text-center text-sm text-sage">
                Sign in above to add time
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-sage/60">
        Purchases are gasless on Arbitrum via Particle Network. USDC is
        deposited to the ArborVault contract — filmmakers are settled daily.
      </p>
    </div>
  );
}
