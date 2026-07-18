"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { applications, filmmakers, users } from "@/lib/db/schema";

export type FilmmakerSettingsInput = {
  fullName: string;
  country: string;
  shortBio: string;
  preferredGenres: string;
  walletAddress: string;
  portfolioLinks: string;
  previousFilmsLink: string;
  previousAwardsLink: string;
  coOwnerFullName: string;
};

export type SettingsActionResult =
  | { ok: true }
  | { ok: false; error: string };

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

function required(value: string | undefined, max: number): string {
  return (value ?? "").trim().slice(0, max);
}

function optional(value: string | undefined, max: number): string | null {
  const trimmed = value?.trim().slice(0, max);
  return trimmed || null;
}

export async function updateFilmmakerProfile(
  input: FilmmakerSettingsInput,
): Promise<SettingsActionResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { ok: false, error: "Please sign in to update your profile." };
  }

  const [user] = await db
    .select({ isFilmmaker: users.isFilmmaker })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (user?.isFilmmaker !== "1") {
    return { ok: false, error: "Your filmmaker access is no longer active." };
  }

  const fullName = required(input.fullName, 400);
  const country = required(input.country, 60);
  const walletAddress = required(input.walletAddress, 100);
  const shortBio = optional(input.shortBio, 3_000);
  const preferredGenres = optional(input.preferredGenres, 200);
  const portfolioLinks = optional(input.portfolioLinks, 4_000);
  const previousFilmsLink = optional(input.previousFilmsLink, 4_000);
  const previousAwardsLink = optional(input.previousAwardsLink, 4_000);
  const coOwnerFullName = optional(input.coOwnerFullName, 400);

  if (!fullName || !country) {
    return { ok: false, error: "Full name and country are required." };
  }
  if (!WALLET_RE.test(walletAddress)) {
    return { ok: false, error: "Enter a valid payout wallet address." };
  }

  try {
    const [updatedFilmmaker] = await db
      .update(filmmakers)
      .set({
        name: fullName,
        country,
        bio: shortBio,
        genre: preferredGenres,
        walletAddress,
      })
      .where(eq(filmmakers.userId, session.userId))
      .returning({ id: filmmakers.id });

    if (!updatedFilmmaker) {
      return { ok: false, error: "Your filmmaker profile is unavailable." };
    }

    // Application submissions are an audit trail. Only mirror the editable
    // profile fields onto the most recent submission when one exists; never
    // create or alter application-only approval data from Settings.
    const [latestApplication] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.userId, session.userId))
      .orderBy(desc(applications.createdAt))
      .limit(1);

    if (latestApplication) {
      await db
        .update(applications)
        .set({
          fullName,
          country,
          paymentWalletAddress: walletAddress,
          shortBio,
          consideredGenre: preferredGenres,
          portfolioLinks,
          previousFilmsLink,
          previousAwardsLink,
          coOwnerFullName,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(applications.id, latestApplication.id),
            eq(applications.userId, session.userId),
          ),
        );
    }

    revalidatePath("/studio");
    revalidatePath("/studio/settings");
    return { ok: true };
  } catch (error) {
    console.error("[updateFilmmakerProfile] update failed:", error);
    return { ok: false, error: "Could not save your changes. Please try again." };
  }
}

export async function leaveFilmmakerProgram(): Promise<SettingsActionResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { ok: false, error: "Please sign in to manage your program status." };
  }

  try {
    const updated = await db
      .update(users)
      .set({ isFilmmaker: "0" })
      .where(
        and(
          eq(users.id, session.userId),
          eq(users.isFilmmaker, "1"),
        ),
      )
      .returning({ id: users.id });

    if (updated.length === 0) {
      return { ok: false, error: "Your filmmaker status is no longer active." };
    }

    // The session contains identity only; filmmaker access is checked from the
    // database on every Studio request, so revoking the flag takes effect on
    // the next navigation without changing the current login session.
    revalidatePath("/studio");
    revalidatePath("/studio/settings");
    return { ok: true };
  } catch (error) {
    console.error("[leaveFilmmakerProgram] update failed:", error);
    return { ok: false, error: "Could not leave the program. Please try again." };
  }
}
