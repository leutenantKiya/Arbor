import { getUsdcBalance } from "@/lib/blockchain/usdc";
import { formatUsdcAmount, shortenAddress } from "@/lib/blockchain/utils";
import {
  getDailyEarnings,
  getFilms,
  getRecentActivity,
  type FilmEarning,
  type FilmmakerBalance,
} from "@/lib/db/queries";
import { formatCents, formatRelativeTime, formatSeconds } from "@/lib/format";
import { FilmEarningsTable } from "@/components/film-earnings-table";
import { StudioShell } from "@/components/studio-shell";
import { StudioEarningsChart } from "@/components/studio-earnings-chart";

// Filmmaker Dashboard — shown on /studio instead of <CreatorApplicationView>
// when users.is_filmmaker === "1". Adapted from Mock UI/filmmaker-dashboard.html
// (layout/feature reference only: sidebar nav, stat grid, earnings chart,
// wallet card, recent activity, films table) rebuilt entirely in Arbor's real
// design tokens via <StudioShell>.
//
// Data is real throughout: getFilmEarnings()/getFilmmakerBalances() already
// power the Studio page; getDailyEarnings()/getRecentActivity() (new, in
// lib/db/queries.ts) aggregate the same debit_events ledger by day and by
// recent row. The connected wallet's on-chain USDC balance reuses the exact
// source components/wallet-info.tsx already uses. The Mock UI's view counts,
// followers, activity ticker copy, and randomly generated earnings chart have
// no backing data in this schema, so real equivalents replace them instead of
// faking the numbers.

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function FilmmakerDashboard({
  displayName,
  walletAddress,
  earnings,
  filmmakerBalances,
}: {
  displayName: string;
  walletAddress: string | null;
  earnings: FilmEarning[];
  filmmakerBalances: FilmmakerBalance[];
}) {
  const hasWallet = !!walletAddress && walletAddress !== ZERO_ADDRESS;

  const [usdcBalanceRaw, films, chart7, chart30, chart90, recentActivity] =
    await Promise.all([
      hasWallet
        ? getUsdcBalance(walletAddress as `0x${string}`).catch(() => null)
        : Promise.resolve(null),
      getFilms().catch(() => []),
      getDailyEarnings(7),
      getDailyEarnings(30),
      getDailyEarnings(90),
      getRecentActivity(6).catch(() => []),
    ]);

  const usdcBalance =
    usdcBalanceRaw !== null ? formatUsdcAmount(usdcBalanceRaw) : null;

  const totalCents = earnings.reduce((a, b) => a + b.totalCents, 0);
  const totalSeconds = earnings.reduce((a, b) => a + b.totalSeconds, 0);
  const pendingCents = filmmakerBalances.reduce(
    (a, b) => a + b.pendingCents,
    0,
  );

  return (
    <StudioShell
      displayName={displayName}
      walletAddress={walletAddress}
      usdcBalance={usdcBalance}
      films={films}
    >
      <div className="mx-auto max-w-5xl px-6 pb-16 pt-8 sm:px-8">
        <p className="animate-rise text-sm uppercase tracking-widest text-fern">
          Filmmaker Studio
        </p>
        <h1
          className="mt-1 animate-rise font-display text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ animationDelay: "0.05s" }}
        >
          Welcome back, {displayName}
        </h1>
        <p
          className="mt-2 animate-rise text-sage"
          style={{ animationDelay: "0.08s" }}
        >
          Here&apos;s how films are performing on Arbor — settled on-chain,
          90% to filmmakers.
        </p>

        {/* Stat grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Films on Arbor"
            value={earnings.length.toLocaleString()}
          />
          <StatCard label="Total watched" value={formatSeconds(totalSeconds)} />
          <StatCard
            label="Total accrued"
            value={formatCents(totalCents)}
            highlight
          />
          <StatCard
            label="Pending settlement"
            value={formatCents(pendingCents)}
          />
        </div>

        {/* Earnings chart + wallet */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-card border border-line bg-surface p-6">
            <StudioEarningsChart
              data={{ 7: chart7, 30: chart30, 90: chart90 }}
            />
          </div>

          <div
            className="rounded-card border border-amber/30 p-6"
            style={{
              background:
                "linear-gradient(160deg, rgba(242,169,59,0.06), transparent 60%), var(--color-surface)",
            }}
          >
            <p className="text-sm uppercase tracking-widest text-amber">
              Wallet
            </p>
            {hasWallet ? (
              <>
                <p className="mt-4 font-mono text-sm text-sage">
                  {shortenAddress(walletAddress!)}
                </p>
                <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-amber-soft">
                  {usdcBalance ?? "—"}
                  <span className="ml-1.5 text-sm font-medium text-sage">
                    USDC
                  </span>
                </p>
              </>
            ) : (
              <p className="mt-4 max-w-[26ch] text-sm text-sage">
                Connect a wallet to see your on-chain USDC balance.
              </p>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="mt-5 rounded-card border border-line bg-surface p-6">
          <p className="text-sm uppercase tracking-widest text-sage">
            Recent activity
          </p>
          <div className="mt-4 space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-sage">
                No viewing activity recorded yet.
              </p>
            ) : (
              recentActivity.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                    <span className="truncate text-cream">
                      {a.seconds}s watched on{" "}
                      <span className="text-amber-soft">{a.filmTitle}</span>
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-ink-faint">
                    {formatRelativeTime(new Date(a.createdAt))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Films table */}
        <h2 className="mt-10 font-display text-2xl font-semibold">Films</h2>
        <div className="mt-4">
          <FilmEarningsTable earnings={earnings} />
        </div>

        <p className="mt-6 text-sm text-sage">
          Settlement history and on-chain proof links appear here once the
          first batch settles.
        </p>
      </div>
    </StudioShell>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-card border p-5 ${
        highlight ? "border-amber/30 bg-surface-2" : "border-line bg-surface"
      }`}
    >
      <p
        className={`text-xs uppercase tracking-widest ${
          highlight ? "text-amber" : "text-sage"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-2 font-display text-2xl font-semibold tabular-nums ${
          highlight ? "text-amber-soft" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
