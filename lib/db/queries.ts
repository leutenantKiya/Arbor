import { eq } from 'drizzle-orm';
import { db } from './client';
import { films, filmmakers } from './schema';
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
