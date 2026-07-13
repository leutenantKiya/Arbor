import Link from "next/link";
import { Logo } from "./logo";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NavSignOut } from "./nav-sign-out";

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

function formatBalance(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export async function Nav() {
  const session = await getSession();
  const balance = session ? await getUserBalance(session.userId) : null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line/60 bg-bark/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <span className="font-display text-xl font-semibold tracking-tight">
            Arbor
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-sm text-sage">
          <Link href="/" className="transition-colors hover:text-cream">
            Browse
          </Link>
          <Link href="/time" className="transition-colors hover:text-cream">
            Time
          </Link>
          <Link href="/studio" className="transition-colors hover:text-cream">
            Studio
          </Link>
          <Link href="/db-status" className="transition-colors hover:text-cream">
            DB
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {session ? (
            <>
              {/* Live balance pill */}
              <Link
                href="/time"
                aria-label="Viewing time remaining"
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-amber-soft transition-colors hover:border-amber/40"
              >
                <span className="tabular-nums">
                  {balance !== null ? formatBalance(balance) : "–"}
                </span>
              </Link>
              {/* User name + sign out */}
              <span className="text-sm text-sage hidden sm:inline">
                {session.name || session.email}
              </span>
              <NavSignOut />
            </>
          ) : (
            <>
              <Link
                href="/time"
                aria-label="Add viewing time"
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-amber-soft transition-colors hover:border-amber/40"
              >
                Add time
              </Link>
              <Link
                href="/auth/sign-in"
                className="rounded-full bg-cream px-4 py-1.5 text-sm font-medium text-bark transition-opacity hover:opacity-90"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
