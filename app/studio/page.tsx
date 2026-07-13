import { films } from "@/lib/films";

// Day-1 shell: live earnings + settlement history land day 5 (the demo money-shot).
export default function StudioPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 pb-20 pt-14">
      <p className="text-sm uppercase tracking-widest text-fern">
        Filmmaker Studio
      </p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
        Earnings
      </h1>
      <p className="mt-2 text-sage">
        You earn 90% of every second watched, settled on-chain. Not next
        quarter — tonight.
      </p>

      <div className="mt-10 overflow-hidden rounded-card border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-sage">
            <tr>
              <th className="px-4 py-3 font-medium">Film</th>
              <th className="px-4 py-3 font-medium">Seconds watched</th>
              <th className="px-4 py-3 font-medium">Accrued</th>
            </tr>
          </thead>
          <tbody className="bg-surface">
            {films.map((f) => (
              <tr key={f.slug} className="border-t border-line/60">
                <td className="px-4 py-3">{f.title}</td>
                <td className="px-4 py-3 tabular-nums text-sage">0</td>
                <td className="px-4 py-3 tabular-nums text-amber-soft">
                  $0.00
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-sm text-sage">
        Settlement history and on-chain proof links appear here once the first
        batch settles.
      </p>
    </div>
  );
}
