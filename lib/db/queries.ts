import { desc, eq, sql } from 'drizzle-orm';
import { db } from './client';
import {
  films,
  filmmakers,
  debitEvents,
  playbackSessions,
  users,
  settlements,
  settlementItems,
  applications,
} from './schema';
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

/** Resolves the filmmakers.id owned by this user, if any (see filmmaker.service.ts). */
export async function getFilmmakerIdByUserId(
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: filmmakers.id })
    .from(filmmakers)
    .where(eq(filmmakers.userId, userId))
    .limit(1);
  return row?.id ?? null;
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

// Any row at all counts — one submission per account, regardless of how the
// application is later reviewed (no status column to filter on yet).
export async function hasExistingApplication(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.userId, userId))
    .limit(1);
  return row !== undefined;
}

// ── Per-filmmaker scoped queries (Filmmaker Dashboard) ──────────────────
// Everything below is scoped to ONE filmmaker's own films/earnings, unlike
// getFilmEarnings()/getFilmmakerBalances() above which stay site-wide for
// CreatorApplicationView. All aggregation happens in SQL (SUM/GROUP BY) —
// no raw event tables are pulled into memory.

export type FilmmakerProfile = {
  id: string;
  name: string;
  walletAddress: string;
  pendingCents: number;
  bio: string | null;
  country: string | null;
  genre: string | null;
};

export async function getFilmmakerProfile(
  filmmakerId: string,
): Promise<FilmmakerProfile | undefined> {
  const [row] = await db
    .select({
      id: filmmakers.id,
      name: filmmakers.name,
      walletAddress: filmmakers.walletAddress,
      pendingCents: filmmakers.pendingCents,
      bio: filmmakers.bio,
      country: filmmakers.country,
      genre: filmmakers.genre,
    })
    .from(filmmakers)
    .where(eq(filmmakers.id, filmmakerId))
    .limit(1);
  return row;
}

/** Per-film watch time + 90% share, scoped to one filmmaker's own films. */
export async function getFilmEarningsForFilmmaker(
  filmmakerId: string,
): Promise<FilmEarning[]> {
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
    .where(eq(films.filmmakerId, filmmakerId))
    .groupBy(films.id, films.slug, films.title)
    .orderBy(films.title);

  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    totalSeconds: Number(r.totalSeconds),
    totalCents: Number(r.totalCents),
  }));
}

/** Real per-day earnings for one filmmaker's own films, last N days. */
export async function getDailyEarningsForFilmmaker(
  filmmakerId: string,
  days: number,
): Promise<DailyEarning[]> {
  const dayExpr = sql<string>`to_char(${debitEvents.createdAt}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      date: dayExpr,
      cents: sql<number>`COALESCE(SUM(${debitEvents.filmmakerCents}), 0)`,
    })
    .from(debitEvents)
    .innerJoin(playbackSessions, eq(debitEvents.sessionId, playbackSessions.id))
    .innerJoin(films, eq(playbackSessions.filmId, films.id))
    .where(
      sql`${films.filmmakerId} = ${filmmakerId} AND ${debitEvents.createdAt} >= now() - (${days} * interval '1 day')`,
    )
    .groupBy(dayExpr)
    .orderBy(dayExpr);

  return rows.map((r) => ({ date: r.date, cents: Number(r.cents) }));
}

/**
 * Sum of this filmmaker's settlement_items marked "paid" — truly settled
 * earnings, as distinct from pendingCents (accrued but not yet settled).
 */
export async function getSettledCentsForFilmmaker(
  filmmakerId: string,
): Promise<number> {
  const [row] = await db
    .select({
      cents: sql<number>`COALESCE(SUM(${settlementItems.cents}), 0)`,
    })
    .from(settlementItems)
    .where(
      sql`${settlementItems.filmmakerId} = ${filmmakerId} AND ${settlementItems.status} = 'paid'`,
    );
  return Number(row?.cents ?? 0);
}

export type FilmmakerActivityItem =
  | { type: 'view'; filmTitle: string; seconds: number; at: Date }
  | { type: 'settlement'; cents: number; status: string; at: Date };

/**
 * Merges real playback ("views") and settlement events for one filmmaker,
 * most recent first — the Dashboard's "Recent activity" feed.
 */
export async function getRecentActivityForFilmmaker(
  filmmakerId: string,
  limit: number,
): Promise<FilmmakerActivityItem[]> {
  const [views, settled] = await Promise.all([
    db
      .select({
        filmTitle: films.title,
        seconds: debitEvents.seconds,
        at: debitEvents.createdAt,
      })
      .from(debitEvents)
      .innerJoin(playbackSessions, eq(debitEvents.sessionId, playbackSessions.id))
      .innerJoin(films, eq(playbackSessions.filmId, films.id))
      .where(eq(films.filmmakerId, filmmakerId))
      .orderBy(desc(debitEvents.createdAt))
      .limit(limit),
    db
      .select({
        cents: settlementItems.cents,
        status: settlementItems.status,
        at: settlements.createdAt,
      })
      .from(settlementItems)
      .innerJoin(settlements, eq(settlementItems.settlementId, settlements.id))
      .where(eq(settlementItems.filmmakerId, filmmakerId))
      .orderBy(desc(settlements.createdAt))
      .limit(limit),
  ]);

  const merged: FilmmakerActivityItem[] = [
    ...views.map((v) => ({
      type: 'view' as const,
      filmTitle: v.filmTitle,
      seconds: v.seconds,
      at: v.at,
    })),
    ...settled.map((s) => ({
      type: 'settlement' as const,
      cents: s.cents,
      status: s.status,
      at: s.at,
    })),
  ];

  merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return merged.slice(0, limit);
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
