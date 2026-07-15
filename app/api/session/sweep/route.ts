import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rollupSession } from "@/lib/db/rollup";

// A session with no heartbeat for this long is treated as dead (crashed tab,
// closed laptop) and rolled up so the filmmaker accrual + audit row aren't
// stranded. User billing is already settled — balance is debited live per
// beat; only the per-session bookkeeping is finished here.
const STALE_AFTER_SECONDS = 60;

// debit_staging rows only need to outlive a crash until rollup runs. After
// this window their session is long since audited, so they're purged.
const STAGING_TTL_DAYS = 7;

// GET so Vercel Cron can call it. Protected by CRON_SECRET when set (Vercel
// Cron sends `Authorization: Bearer <CRON_SECRET>`); unprotected in dev if the
// env var is absent. Idempotent — rollup and purge are both safe to repeat.
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Unaudited sessions that are already closed OR have gone silent past the
  // stale window.
  const dead = await db.execute(sql`
    SELECT id FROM playback_sessions
    WHERE audited_at IS NULL
      AND (
        active = false
        OR COALESCE(last_beat_at, started_at) < now() - make_interval(secs => ${STALE_AFTER_SECONDS})
      )
  `);

  const ids = (dead.rows as { id: string }[]).map((r) => r.id);
  for (const id of ids) {
    await rollupSession(id);
  }

  const purged = await db.execute(sql`
    DELETE FROM debit_staging
    WHERE created_at < now() - make_interval(days => ${STAGING_TTL_DAYS})
  `);
  const purgedCount = (purged as unknown as { rowCount?: number }).rowCount ?? 0;

  return NextResponse.json({
    ok: true,
    sessionsAudited: ids.length,
    stagingRowsPurged: purgedCount,
  });
}
