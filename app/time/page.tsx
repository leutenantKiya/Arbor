import { AuthButton } from '@/components/auth-button';
import { PurchaseButton } from '@/components/purchase-button';
import { GiftTimeModal } from '@/components/gift-time-modal';
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
  if (seconds <= 0) return '0s';
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
    <>
      {/* quiet drifting backdrop — this is a billing page, not a hero */}
      <div className="ambient" aria-hidden="true">
        <span />
        <span />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-14">
        <header className="animate-rise">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
              Your time
            </h1>
            {session && (
              <GiftTimeModal initialBalanceSeconds={balanceSeconds ?? 0} />
            )}
          </div>
          <p className="mt-3 max-w-[58ch] font-mono text-sm leading-relaxed text-sage">
            Time is only used while a film is playing. Browsing, trailers, and
            pausing are always free. Your balance never runs out on its own.
          </p>
        </header>

        {/* Balance card */}
        {session && (
          <div
            className="mt-8 animate-rise rounded-2xl border border-amber/30 p-7"
            style={{
              animationDelay: '0.1s',
              background:
                'linear-gradient(160deg, rgba(242,169,59,0.06), transparent 60%), var(--color-surface)',
            }}
          >
            <p className="font-mono text-[0.68rem] tracking-[0.14em] text-amber">
              CURRENT BALANCE
            </p>
            <p className="mt-2.5 animate-num-flash font-display text-5xl font-semibold tabular-nums">
              {balanceSeconds !== null ? formatBalance(balanceSeconds) : '—'}
            </p>
            <p className="mt-1 font-mono text-xs text-ink-faint">
              {session.email || 'Signed in'}
            </p>
          </div>
        )}

        {!session && (
          <div className="mt-8 rounded-2xl border border-line p-6 text-center">
            <p className="font-mono text-sm text-sage">
              Sign in to see your balance and add viewing time.
            </p>
            {/* Single auth system: Particle (via the nav AuthButton or the
                /auth/login gate). The old email/password mock path has been
                removed. */}
            <div className="mt-4 flex justify-center">
              <AuthButton hasSession={false} />
            </div>
          </div>
        )}

        {/* Packages */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {packages.map((p, i) => (
            <div
              key={p.id}
              className={`relative flex animate-rise flex-col rounded-2xl border p-6 ${
                p.popular
                  ? 'border-amber/55 bg-surface shadow-[0_0_0_1px_rgba(242,169,59,0.12),0_18px_40px_-18px_rgba(242,169,59,0.35)]'
                  : 'border-line bg-surface'
              }`}
              style={{ animationDelay: `${0.18 + i * 0.08}s` }}
            >
              {p.popular && (
                <p className="mb-3 font-mono text-[0.62rem] tracking-[0.12em] text-amber">
                  MOST POPULAR
                </p>
              )}
              <p className="font-display text-2xl font-semibold">
                {p.hours}
                <span className="ml-1.5 text-base font-medium text-sage">hours</span>
              </p>
              <p className="mt-1 font-mono text-xs text-ink-faint">{p.note}</p>
              <p className="mt-4 font-display text-2xl font-semibold text-amber-soft">
                {p.price}
              </p>
              {session ? (
                <PurchaseButton
                  packageId={p.id}
                  price={p.price}
                  cents={p.cents}
                  seconds={p.seconds}
                />
              ) : (
                <p className="mt-auto pt-6 font-mono text-xs text-sage">
                  Sign in above to add time
                </p>
              )}
            </div>
          ))}
        </div>

        <p className="mt-8 max-w-[64ch] font-mono text-xs leading-relaxed text-ink-faint">
          Purchases are gasless via Particle Network. USDC is deposited to the
          ArborVault contract — filmmakers are settled daily.
        </p>
      </div>
    </>
  );
}
