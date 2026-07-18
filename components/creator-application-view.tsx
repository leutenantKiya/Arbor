import type { FilmEarning, FilmmakerBalance } from "@/lib/db/queries";
import { formatCents, formatSeconds } from "@/lib/format";
import { ApplyCreator } from "@/components/apply-creator";
import { FilmEarningsTable } from "@/components/film-earnings-table";

// The default Studio-page experience for signed-in users who are not yet a
// filmmaker (users.is_filmmaker !== "1"): the site-wide earnings overview plus
// the "Apply as Creator" CTA. Unchanged from the original Studio page — only
// extracted into its own component so app/studio/page.tsx can switch between
// this and <FilmmakerDashboard> (lib/db/queries.ts now owns the data fetches).
export function CreatorApplicationView({
  earnings,
  filmmakerBalances,
}: {
  earnings: FilmEarning[];
  filmmakerBalances: FilmmakerBalance[];
}) {
  const totalCents = earnings.reduce((a, b) => a + b.totalCents, 0);
  const totalSeconds = earnings.reduce((a, b) => a + b.totalSeconds, 0);

  return (
    <div className="mx-auto max-w-4xl px-6 pb-20 pt-14">
      <p className="text-sm uppercase tracking-widest text-fern">
        Filmmaker Studio
      </p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
        Earnings
      </h1>
      <p className="mt-2 text-sage">
        Filmmakers earn 90% of every second watched, settled on-chain. Not next
        quarter — tonight.
      </p>

      {/* Primary CTA — become a creator */}
      <ApplyCreator />

      {/* Summary cards */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-6">
          <p className="text-sm uppercase tracking-widest text-sage">Total watched</p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
            {formatSeconds(totalSeconds)}
          </p>
        </div>
        <div className="rounded-card border border-amber/30 bg-surface-2 p-6">
          <p className="text-sm uppercase tracking-widest text-amber">Total accrued</p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-amber-soft">
            {formatCents(totalCents)}
          </p>
        </div>
      </div>

      {/* Per-film table */}
      <div className="mt-10">
        <FilmEarningsTable earnings={earnings} />
      </div>

      {/* Filmmaker pending balances */}
      {filmmakerBalances.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-2xl font-semibold">
            Filmmaker balances
          </h2>
          <div className="mt-4 overflow-hidden rounded-card border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-sage">
                <tr>
                  <th className="px-4 py-3 font-medium">Filmmaker</th>
                  <th className="px-4 py-3 font-medium">Pending (unsettled)</th>
                </tr>
              </thead>
              <tbody className="bg-surface">
                {filmmakerBalances.map((fm, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className="px-4 py-3">{fm.name}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-soft">
                      {formatCents(fm.pendingCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-6 text-sm text-sage">
        Settlement history and on-chain proof links appear here once the first
        batch settles.
      </p>
    </div>
  );
}
