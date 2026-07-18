import Link from "next/link";
import { AuthButton } from "./auth-button";
import { BalancePill } from "./balance-pill";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { FilmSearch } from "./film-search";
import { WalletInfo } from "./wallet-info";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUsdcBalance } from "@/lib/blockchain/usdc";
import { formatUsdcAmount } from "@/lib/blockchain/utils";
import { getFilms } from "@/lib/db/queries";

async function getUserBalance(userId: string): Promise<number | null> {
  try {
    const [user] = await db
      .select({ balanceSeconds: users.balanceSeconds })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user?.balanceSeconds ?? null;
  } catch {
    return null;
  }
}

export async function Nav() {
  const [session, films] = await Promise.all([
    getSession(),
    getFilms().catch(() => []),
  ]);
  const balance = session ? await getUserBalance(session.userId) : null;

  let usdcBalance: string | null = null;
  if (session?.walletAddress && session.walletAddress !== "0x0000000000000000000000000000000000000000") {
    try {
      const bal = await getUsdcBalance(session.walletAddress as `0x${string}`);
      usdcBalance = formatUsdcAmount(bal);
    } catch {
      // ignore RPC failures in SSR
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-[70] border-b border-line-soft bg-bark/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-5 sm:px-6 lg:gap-7">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Logo className="h-7 w-7" />
          <span className="font-block text-2xl font-extrabold tracking-wide">
            Arbor
          </span>
        </Link>

        <NavLinks />

        <div className="min-w-0 flex-1">
          <FilmSearch films={films} />
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {session ? (
            <>
              {/* Wallet Info (USDC + Address with Copy) */}
              {session.walletAddress && session.walletAddress !== "0x0000000000000000000000000000000000000000" && (
                <WalletInfo address={session.walletAddress} usdcBalance={usdcBalance} />
              )}

              {/* Live viewing time balance pill */}
              <BalancePill initialSeconds={balance} />
            </>
          ) : (
            <Link
              href="/time"
              aria-label="Add viewing time"
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-amber-soft transition-colors hover:border-amber/40"
            >
              Add time
            </Link>
          )}
          {/* Sign in / sign out — Particle connectkit, both states */}
          <AuthButton hasSession={!!session} />
        </div>
      </div>
    </header>
  );
}
