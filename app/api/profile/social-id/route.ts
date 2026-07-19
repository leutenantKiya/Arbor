import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/server";

// Alphanumeric + underscore, 1-24 chars, lowercase only
const SOCIAL_ID_RE = /^[a-z0-9_]{1,24}$/;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  let socialId: unknown;
  try {
    ({ socialId } = await request.json());
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
  }

  if (typeof socialId !== "string" || !socialId.trim()) {
    return NextResponse.json({ success: false, message: "Social ID is required" }, { status: 400 });
  }

  // Normalize: trim + lowercase
  const normalized = socialId.trim().toLowerCase();

  if (!SOCIAL_ID_RE.test(normalized)) {
    return NextResponse.json(
      { success: false, message: "Social ID must be 1-24 characters: lowercase letters, numbers, or underscores" },
      { status: 400 },
    );
  }

  // Check if current user already has a Social ID set (immutable check)
  const [currentUser] = await db
    .select({ socialId: users.socialId })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (currentUser?.socialId) {
    return NextResponse.json(
      { success: false, message: "Social ID already exists and cannot be changed" },
      { status: 400 },
    );
  }

  // Check duplicate
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.socialId, normalized))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { success: false, message: "Social ID already taken" },
      { status: 409 },
    );
  }

  // Update
  await db
    .update(users)
    .set({ socialId: normalized })
    .where(eq(users.id, session.userId));

  return NextResponse.json({ success: true, socialId: normalized });
}
