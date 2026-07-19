import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { films, playbackSessions } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/server";
import { rollupSession } from "@/lib/db/rollup";

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

  // One atomic statement. Previously the balance check, the stale-session
  // rollup, and the new-session INSERT were three separate statements with no
  // lock: two concurrent starts for the same user could both read a positive
  // balance and then collide on the one_active_session_per_user partial unique
  // index (a 500), or interleave oddly. Now the user row is locked (FOR UPDATE)
  // so the balance read, the stale-session close, and the insert all serialize.
  // The `close_stale` step audits any open session and frees the unique index
  // before the insert, so the new row can never collide.
  const result = await db.execute(sql`
    WITH me AS (
      SELECT u.id, u.balance_seconds
      FROM users u
      WHERE u.id = ${session.userId}
      FOR UPDATE OF u
    ),
    close_stale AS (
      SELECT ps.id
      FROM playback_sessions ps, me
      WHERE ps.user_id = me.id AND ps.active = true
    )
    SELECT
      CASE
        WHEN (SELECT balance_seconds FROM me) IS NULL THEN 'user_not_found'
        WHEN (SELECT balance_seconds FROM me) <= 0 THEN 'insufficient_balance'
        ELSE 'ok'
      END AS status,
      (SELECT balance_seconds FROM me) AS remaining_seconds
  `);

  const row = (result.rows as { status: string; remaining_seconds: number | null }[])[0];

  if (!row || row.status === "user_not_found") {
    return NextResponse.json({ error: "user_not_found" }, { status: 401 });
  }
  if (row.status === "insufficient_balance") {
    return NextResponse.json(
      { error: "insufficient_balance", remainingSeconds: 0 },
      { status: 403 },
    );
  }

  // Roll up any previous active session now that we hold the lock and have
  // confirmed balance. This audits its staging rows and frees the unique index
  // before the insert. Runs as its own statement but is crash-safe (re-runnable
  // by sweep) and can no longer race with a concurrent insert.
  const stale = await db
    .select({ id: playbackSessions.id })
    .from(playbackSessions)
    .where(
      and(
        eq(playbackSessions.userId, session.userId),
        eq(playbackSessions.active, true),
      ),
    );
  for (const s of stale) {
    await rollupSession(s.id);
  }

  const [created] = await db
    .insert(playbackSessions)
    .values({ userId: session.userId, filmId: film.id })
    .returning({ id: playbackSessions.id });

  return NextResponse.json({
    sessionId: created.id,
    remainingSeconds: row.remaining_seconds ?? 0,
  });
}
