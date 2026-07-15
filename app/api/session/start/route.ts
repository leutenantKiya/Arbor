import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { films, playbackSessions, users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/server";

// session.userId is always the canonical ledger users.id (both Particle and
// password sign-in sign it), so the ledger row is guaranteed to exist here —
// no lazy-create needed.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let slug: unknown;
  try {
    ({ slug } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof slug !== "string" || !slug) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const [film] = await db
    .select({ id: films.id })
    .from(films)
    .where(eq(films.slug, slug));
  if (!film) {
    return NextResponse.json({ error: "film_not_found" }, { status: 404 });
  }

  const [ledgerUser] = await db
    .select({ id: users.id, balanceSeconds: users.balanceSeconds })
    .from(users)
    .where(eq(users.id, session.userId));
  if (!ledgerUser) {
    return NextResponse.json({ error: "user_not_found" }, { status: 401 });
  }

  if (ledgerUser.balanceSeconds <= 0) {
    return NextResponse.json(
      { error: "insufficient_balance", remainingSeconds: 0 },
      { status: 403 },
    );
  }

  // Close any previous active session so the one_active_session_per_user
  // partial unique index accepts the new row.
  await db
    .update(playbackSessions)
    .set({ active: false, endedAt: new Date() })
    .where(
      and(
        eq(playbackSessions.userId, ledgerUser.id),
        eq(playbackSessions.active, true),
      ),
    );

  const [created] = await db
    .insert(playbackSessions)
    .values({ userId: ledgerUser.id, filmId: film.id })
    .returning({ id: playbackSessions.id });

  return NextResponse.json({
    sessionId: created.id,
    remainingSeconds: ledgerUser.balanceSeconds,
  });
}
