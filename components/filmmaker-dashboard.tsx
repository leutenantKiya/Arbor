import { getUsdcBalance } from "@/lib/blockchain/usdc";
import { formatUsdcAmount, shortenAddress } from "@/lib/blockchain/utils";
import {
  getDailyEarningsForFilmmaker,
  getFilmEarningsForFilmmaker,
  getFilmmakerProfile,
  getFilms,
  getRecentActivityForFilmmaker,
  getSettledCentsForFilmmaker,
} from "@/lib/db/queries";
import { formatCents, formatRelativeTime, formatSeconds } from "@/lib/format";
import { FilmEarningsTable } from "@/components/film-earnings-table";
import { StudioShell } from "@/components/studio-shell";
import { StudioEarningsChart } from "@/components/studio-earnings-chart";

// Filmmaker Dashboard — shown on /studio instead of <CreatorApplicationView>
// when users.is_filmmaker === "1". Adapted from Mock UI/filmmaker-dashboard.html
// as a layout/feature reference (sidebar nav, stat grid, earnings chart,
// wallet card, recent activity, films table), rebuilt in Arbor's real design
// tokens via <StudioShell>.
//
// Every widget here is scoped to THIS filmmaker (via filmmakerId, resolved
// upstream by lib/services/filmmaker.service.ts) and computed with SQL
// aggregation in lib/db/queries.ts — no site-wide totals, no in-memory
// scanning of raw event tables, no hardcoded numbers.

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function FilmmakerDashboard({
  filmmakerId,
  displayName,
  walletAddress,
}: {
  filmmakerId: string;
  displayName: string;
  walletAddress: string | null;
}) {
  const hasWallet = !!walletAddress && walletAddress !== ZERO_ADDRESS;

  const [
    profile,
    earnings,
    chart7,
    chart30,
    chart90,
    settledCents,
    recentActivity,
    usdcBalanceRaw,
    films,
  ] = await Promise.all([
    getFilmmakerProfile(filmmakerId),
    getFilmEarningsForFilmmaker(filmmakerId),
    getDailyEarningsForFilmmaker(filmmakerId, 7),
    getDailyEarningsForFilmmaker(filmmakerId, 30),
    getDailyEarningsForFilmmaker(filmmakerId, 90),
    getSettledCentsForFilmmaker(filmmakerId),
    getRecentActivityForFilmmaker(filmmakerId, 8),
    hasWallet
      ? getUsdcBalance(walletAddress as `0x${string}`).catch(() => null)
      : Promise.resolve(null),
    getFilms().catch(() => []),
  ]);

  const usdcBalance =
    usdcBalanceRaw !== null ? formatUsdcAmount(usdcBalanceRaw) : null;

  const totalSeconds = earnings.reduce((a, b) => a + b.totalSeconds, 0);
  const pendingCents = profile?.pendingCents ?? 0;

  const subtitleTags = [profile?.genre, profile?.country].filter(
    (v): v is string => !!v,
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
          {subtitleTags.length > 0
            ? `${subtitleTags.join(" · ")} filmmaker on Arbor — settled on-chain, 90% to you.`
            : "Here's how your films are performing on Arbor — settled on-chain, 90% to you."}
        </p>

        {/* Stat grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Films on Arbor"
            value={earnings.length.toLocaleString()}
          />
          <StatCard label="Total watched" value={formatSeconds(totalSeconds)} />
          <StatCard
            label="Total earnings"
            value={formatCents(settledCents)}
            sub="Settled on-chain"
            highlight
          />
          <StatCard
            label="Pending settlement"
            value={formatCents(pendingCents)}
            sub="Accrued, not yet paid"
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
                No activity recorded yet.
              </p>
            ) : (
              recentActivity.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        a.type === "settlement" ? "bg-fern" : "bg-amber"
                      }`}
                    />
                    {a.type === "view" ? (
                      <span className="truncate text-cream">
                        {a.seconds}s watched on{" "}
                        <span className="text-amber-soft">{a.filmTitle}</span>
                      </span>
                    ) : (
                      <span className="truncate text-cream">
                        Settlement of{" "}
                        <span className="text-fern">
                          {formatCents(a.cents)}
                        </span>{" "}
                        {a.status === "paid" ? "paid" : "pending"}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 font-mono text-xs text-ink-faint">
                    {formatRelativeTime(new Date(a.at))}
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
          Settlement history and on-chain proof links appear here once your
          first batch settles.
        </p>
      </div>
    </StudioShell>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
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
      {sub && <p className="mt-1 text-[0.68rem] text-ink-faint">{sub}</p>}
    </div>
  );
}
