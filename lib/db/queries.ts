import { desc, eq, sql } from 'drizzle-orm';
import { db } from './client';
import { films, filmmakers, debitEvents, playbackSessions, users } from './schema';
import type { Film } from '@/lib/films';

type FilmRow = {
  slug: string;
  title: string;
  synopsis: string;
  category: string;
  year: number;
  durationSeconds: number;
  videoUrl: string;
  posterUrl: string;
  filmmaker: string | null;
};

function mapDbFilmToAppFilm(row: FilmRow): Film {
  return {
    slug: row.slug,
    title: row.title,
    synopsis: row.synopsis,
    durationSeconds: row.durationSeconds,
    category: row.category as Film['category'],
    year: row.year,
    filmmaker: row.filmmaker ?? 'Unknown filmmaker',
    videoUrl: row.videoUrl,
    posterUrl: row.posterUrl,
    backdropUrl: row.posterUrl,
  };
}

export async function getFilms(): Promise<Film[]> {
  const rows = await db
    .select({
      slug: films.slug,
      title: films.title,
      synopsis: films.synopsis,
      category: films.category,
      year: films.year,
      durationSeconds: films.durationSeconds,
      videoUrl: films.videoUrl,
      posterUrl: films.posterUrl,
      filmmaker: filmmakers.name,
    })
    .from(films)
    .leftJoin(filmmakers, eq(films.filmmakerId, filmmakers.id));

  return rows.map(mapDbFilmToAppFilm);
}

// ── Studio page (Creator Application + Filmmaker Dashboard) ────────────

export type FilmEarning = {
  slug: string;
  title: string;
  totalSeconds: number;
  totalCents: number;
};

/**
 * Per-film watch time and 90% filmmaker share, joined from
 * films → playback_sessions → debit_events. Powers both Studio branches.
 */
export async function getFilmEarnings(): Promise<FilmEarning[]> {
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

export type FilmmakerBalance = {
  name: string;
  pendingCents: number;
};

/** Unsettled (pending) balances per filmmaker, in USDC cents. */
export async function getFilmmakerBalances(): Promise<FilmmakerBalance[]> {
  const rows = await db
    .select({
      name: filmmakers.name,
      pendingCents: sql<number>`COALESCE(SUM(${filmmakers.pendingCents}), 0)`,
    })
    .from(filmmakers)
    .groupBy(filmmakers.name)
    .orderBy(filmmakers.name);
  return rows.map((r) => ({
    name: r.name,
    pendingCents: Number(r.pendingCents),
  }));
}

export type DailyEarning = { date: string; cents: number };

/**
 * Real per-day filmmaker-share totals for the last N days, grouped from
 * debit_events.created_at. Powers the Filmmaker Dashboard's earnings chart —
 * no synthetic/random data, unlike the Mock UI reference.
 */
export async function getDailyEarnings(days: number): Promise<DailyEarning[]> {
  const dayExpr = sql<string>`to_char(${debitEvents.createdAt}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      date: dayExpr,
      cents: sql<number>`COALESCE(SUM(${debitEvents.filmmakerCents}), 0)`,
    })
    .from(debitEvents)
    .where(sql`${debitEvents.createdAt} >= now() - (${days} * interval '1 day')`)
    .groupBy(dayExpr)
    .orderBy(dayExpr);

  return rows.map((r) => ({ date: r.date, cents: Number(r.cents) }));
}

export type RecentActivityItem = {
  filmTitle: string;
  seconds: number;
  createdAt: Date;
};

/** Most recent real playback debits, joined to film titles. */
export async function getRecentActivity(
  limit: number,
): Promise<RecentActivityItem[]> {
  return db
    .select({
      filmTitle: films.title,
      seconds: debitEvents.seconds,
      createdAt: debitEvents.createdAt,
    })
    .from(debitEvents)
    .innerJoin(playbackSessions, eq(debitEvents.sessionId, playbackSessions.id))
    .innerJoin(films, eq(playbackSessions.filmId, films.id))
    .orderBy(desc(debitEvents.createdAt))
    .limit(limit);
}

/** Reads users.is_filmmaker ("0"/"1" text column) for the session's user. */
export async function isUserFilmmaker(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ isFilmmaker: users.isFilmmaker })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.isFilmmaker === '1';
}

export async function getFilmBySlug(slug: string): Promise<Film | undefined> {
  const result = await db
    .select({
      slug: films.slug,
      title: films.title,
      synopsis: films.synopsis,
      category: films.category,
      year: films.year,
      durationSeconds: films.durationSeconds,
      videoUrl: films.videoUrl,
      posterUrl: films.posterUrl,
      filmmaker: filmmakers.name,
    })
    .from(films)
    .leftJoin(filmmakers, eq(films.filmmakerId, filmmakers.id))
    .where(eq(films.slug, slug));

  const row = Array.isArray(result) ? result[0] : undefined;
  return row ? mapDbFilmToAppFilm(row as FilmRow) : undefined;
}
