// Filmmaker provisioning — auto-creates a `filmmakers` row for a user the
// first time they're flagged is_filmmaker and visit the Studio page.
//
// There's no separate "approved" status on `applications` (it's just a
// submission log) — is_filmmaker being "1" is already the de facto approval
// signal in this system (set out-of-band once someone's application is
// reviewed), so this trusts the caller to have checked that first and simply
// uses the user's most recent application as the data source.
//
// Idempotent by construction: filmmakers.user_id has a partial unique index
// (schema.ts), so a concurrent duplicate insert is caught by the DB and
// resolved here by re-selecting rather than erroring — refreshing the Studio
// page can never create a second row for the same user.

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { applications, filmmakers } from "@/lib/db/schema";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type FilmmakerFallback = {
  walletAddress?: string | null;
  name?: string | null;
  email?: string | null;
};

export async function ensureFilmmakerRecord(
  userId: string,
  fallback: FilmmakerFallback = {},
): Promise<string> {
  const [existing] = await db
    .select({ id: filmmakers.id })
    .from(filmmakers)
    .where(eq(filmmakers.userId, userId))
    .limit(1);
  if (existing) return existing.id;

  // Most recent submission if they applied more than once.
  const [application] = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.createdAt))
    .limit(1);

  const name =
    application?.fullName?.trim() ||
    fallback.name?.trim() ||
    fallback.email?.trim() ||
    "Filmmaker";
  const walletAddress =
    application?.paymentWalletAddress?.trim() ||
    fallback.walletAddress?.trim() ||
    ZERO_ADDRESS;
  const bio = application?.shortBio ?? null;
  const country = application?.country ?? null;
  const genre = application?.consideredGenre ?? null;

  const result = await db.execute(sql`
    INSERT INTO filmmakers (user_id, name, wallet_address, bio, country, genre)
    VALUES (${userId}, ${name}, ${walletAddress}, ${bio}, ${country}, ${genre})
    ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO NOTHING
    RETURNING id
  `);

  const insertedId = (result.rows[0] as { id: string } | undefined)?.id;
  if (insertedId) return insertedId;

  // Lost a concurrent race (e.g. two tabs loading /studio at once) — the
  // other request's row already exists.
  const [row] = await db
    .select({ id: filmmakers.id })
    .from(filmmakers)
    .where(eq(filmmakers.userId, userId))
    .limit(1);

  if (!row) {
    throw new Error(`Failed to provision filmmaker record for user ${userId}`);
  }
  return row.id;
}
