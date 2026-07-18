import type { FilmEarning } from "@/lib/db/queries";
import { formatCents } from "@/lib/format";

// Shared by CreatorApplicationView and FilmmakerDashboard — one table
// definition for "Film / Seconds watched / Accrued (90%)".
export function FilmEarningsTable({ earnings }: { earnings: FilmEarning[] }) {
  return (
    <div className="overflow-hidden rounded-card border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-2 text-sage">
          <tr>
            <th className="px-4 py-3 font-medium">Film</th>
            <th className="px-4 py-3 font-medium">Seconds watched</th>
            <th className="px-4 py-3 font-medium">Accrued (90%)</th>
          </tr>
        </thead>
        <tbody className="bg-surface">
          {earnings.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-sage">
                No films in the database yet — run{" "}
                <code className="rounded bg-bark/70 px-1.5 py-0.5 text-xs">
                  npm run db:seed
                </code>
              </td>
            </tr>
          ) : (
            earnings.map((f) => (
              <tr key={f.slug} className="border-t border-line/60">
                <td className="px-4 py-3">{f.title}</td>
                <td className="px-4 py-3 tabular-nums text-sage">
                  {f.totalSeconds.toLocaleString()}
                </td>
                <td className="px-4 py-3 tabular-nums text-amber-soft">
                  {formatCents(f.totalCents)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
