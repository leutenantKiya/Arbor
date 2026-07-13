import Link from "next/link";
import { AuthButton } from "./auth-button";
import { Logo } from "./logo";

export function Nav() {
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
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {/* Time pill — wired to the ledger on day 3; calm by design (PLANNING.md §9) */}
          <Link
            href="/time"
            aria-label="Viewing time remaining"
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-amber-soft transition-colors hover:border-amber/40"
          >
            <span className="tabular-nums">2h 30m</span>
          </Link>
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
