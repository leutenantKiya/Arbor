'use server';

// Film creation — DB logic only. Takes already-uploaded Cloudinary metadata
// (see components/upload-film.tsx for the upload step, lib/cloudinary/actions.ts
// for the signing step) and inserts one films row. Never calls Cloudinary
// itself — if the upload didn't happen, this simply isn't called.

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { films } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/server';
import { getFilmmakerIdByUserId, isUserFilmmaker } from '@/lib/db/queries';

// Mirrors the Film['category'] union (lib/films.ts) that the rest of the app
// (browse/filter) already assumes — not a DB constraint, but staying inside
// it keeps every existing film-list page consistent.
const CATEGORIES = ['Animation', 'Sci-Fi', 'Fantasy'] as const;
const VALID_VIDEO_FORMATS = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'];

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';

export type CreateFilmInput = {
  title: string;
  synopsis: string;
  category: string;
  year: number;
  cloudinary: {
    secureUrl: string;
    publicId: string;
    duration: number;
    format: string;
  };
  posterUrl: string;
};

export type CreateFilmResult = { ok: true; slug: string } | { ok: false; error: string };

function slugify(title: string): string {
  // NFKD decomposes accented characters (é → e + combining mark); the
  // alnum-only strip below then drops the leftover combining marks along
  // with every other non-alphanumeric character in one pass.
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'film';
}

/** Single query to find the next free "title", "title-2", "title-3", ... slug. */
async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  const existing = await db
    .select({ slug: films.slug })
    .from(films)
    .where(sql`${films.slug} = ${base} OR ${films.slug} LIKE ${base + '-%'}`);

  const taken = new Set(existing.map((r) => r.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export async function createFilmFromUpload(
  input: CreateFilmInput,
): Promise<CreateFilmResult> {
  // ── Validate required fields ──
  const title = input.title?.trim() ?? '';
  const synopsis = input.synopsis?.trim() ?? '';
  const category = input.category?.trim() ?? '';
  const year = Number(input.year);
  const currentYear = new Date().getFullYear();

  if (!title || !synopsis || !category) {
    return { ok: false, error: 'Please complete all required fields.' };
  }
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    return { ok: false, error: 'Select a valid category.' };
  }
  if (!Number.isInteger(year) || year < 1888 || year > currentYear + 1) {
    return { ok: false, error: 'Enter a valid release year.' };
  }

  // ── Never insert unless the Cloudinary upload genuinely completed ──
  const { secureUrl, publicId, duration, format } = input.cloudinary ?? {};
  const expectedPrefix = CLOUD_NAME
    ? `https://res.cloudinary.com/${CLOUD_NAME}/`
    : 'https://res.cloudinary.com/';

  if (!secureUrl || !secureUrl.startsWith(expectedPrefix) || !publicId) {
    return { ok: false, error: 'Video upload did not complete successfully.' };
  }
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
    return { ok: false, error: 'Video upload did not complete successfully.' };
  }
  if (!format || !VALID_VIDEO_FORMATS.includes(format.toLowerCase())) {
    return { ok: false, error: 'Unsupported video format.' };
  }
  if (!input.posterUrl) {
    return { ok: false, error: 'Missing a poster/thumbnail image.' };
  }

  // ── Resolve the authenticated filmmaker (reuses the existing session) ──
  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Please sign in to upload a film.' };
  }
  const isFilmmaker = await isUserFilmmaker(session.userId);
  if (!isFilmmaker) {
    return { ok: false, error: 'Only verified filmmakers can upload films.' };
  }
  const filmmakerId = await getFilmmakerIdByUserId(session.userId);
  if (!filmmakerId) {
    return {
      ok: false,
      error: "Your filmmaker profile isn't set up yet — reload the Studio page and try again.",
    };
  }

  const slug = await generateUniqueSlug(title);

  await db.insert(films).values({
    slug,
    title,
    synopsis,
    category,
    year,
    durationSeconds: Math.round(duration),
    videoUrl: secureUrl,
    posterUrl: input.posterUrl,
    filmmakerId,
  });

  return { ok: true, slug };
}
