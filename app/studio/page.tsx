import { db } from "@/lib/db/client";
import { films, filmmakers, debitEvents, playbackSessions } from "@/lib/db/schema";
import { eq, sum, sql } from "drizzle-orm";

type FilmEarning = {
  slug: string;
  title: string;
  totalSeconds: number;
  totalCents: number;
};

async function getFilmEarnings(): Promise<FilmEarning[]> {
  // Join films → playbackSessions → debitEvents to get per-film totals
  const rows = await db
    .select({
      slug: films.slug,
      title: films.title,
      totalSeconds: sql<number>`COALESCE(SUM(${debitEvents.seconds}), 0)`,
      totalCents: sql<number>`COALESCE(SUM(${debitEvents.filmmakerCents}), 0)`,
    })
    .from(films)
    .leftJoin(playbackSessions, eq(playbackSessions.filmId, films.id))
    .leftJoin(debitEvents, eq(debitEvents.sessionId, playbackSessions.id))
    .groupBy(films.id, films.slug, films.title)
    .orderBy(films.title);

  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    totalSeconds: Number(r.totalSeconds),
    totalCents: Number(r.totalCents),
  }));
}

async function getFilmmakerStats() {
  const rows = await db
    .select({
      name: filmmakers.name,
      pendingCents: filmmakers.pendingCents,
    })
    .from(filmmakers)
    .orderBy(filmmakers.name);
  return rows;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatSeconds(s: number): string {
  if (s === 0) return "0";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default async function StudioPage() {
  const [earnings, filmmakers_] = await Promise.all([
    getFilmEarnings(),
    getFilmmakerStats(),
  ]);

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
        You earn 90% of every second watched, settled on-chain. Not next
        quarter — tonight.
      </p>

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
      <div className="mt-10 overflow-hidden rounded-card border border-line">
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

      {/* Filmmaker pending balances */}
      {filmmakers_.length > 0 && (
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
                {filmmakers_.map((fm, i) => (
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
