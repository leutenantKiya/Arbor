import { sql } from "drizzle-orm";
import { db } from "./client";

// Audits a session exactly once: sums its debit_staging rows into a single
// permanent debit_events row, accrues the filmmaker's 90% share, and stamps
// audited_at (also flipping active=false / ended_at if not already closed).
//
// Idempotent by construction. The `s` CTE selects the session FOR UPDATE only
// while audited_at IS NULL, so:
//   - a second call finds nothing and is a no-op
//   - two concurrent calls serialize on the row lock; after the first commits
//     audited_at, Postgres re-evaluates the WHERE (EvalPlanQual) for the
//     second, which now filters the row out — no double debit_events/accrual.
//
// Rounding the filmmaker share once on the session total is more accurate than
// per-beat rounding (which rounded every 0.9¢ up to 1¢, inflating payouts).
//
// Called by /session/end, the lazy close in /session/start, the heartbeat
// exhaustion path, and /session/sweep — every path that closes a session.
export async function rollupSession(sessionId: string): Promise<void> {
  await db.execute(sql`
    WITH s AS (
      SELECT ps.id, ps.film_id
      FROM playback_sessions ps
      WHERE ps.id = ${sessionId}
        AND ps.audited_at IS NULL
      FOR UPDATE
    ),
    agg AS (
      SELECT s.id AS session_id,
             s.film_id,
             COALESCE(SUM(st.seconds), 0)::int AS total_seconds,
             ROUND(COALESCE(SUM(st.seconds), 0) * 0.9 / 10.0)::int AS filmmaker_cents
      FROM s
      LEFT JOIN debit_staging st ON st.session_id = s.id
      GROUP BY s.id, s.film_id
    ),
    ins AS (
      INSERT INTO debit_events (session_id, seconds, filmmaker_cents)
      SELECT session_id, total_seconds, filmmaker_cents
      FROM agg
      WHERE total_seconds > 0
      RETURNING session_id
    ),
    accrue AS (
      UPDATE filmmakers f
      SET pending_cents = f.pending_cents + agg.filmmaker_cents
      FROM agg
      JOIN films fl ON fl.id = agg.film_id
      WHERE f.id = fl.filmmaker_id
        AND agg.filmmaker_cents > 0
      RETURNING f.id
    )
    UPDATE playback_sessions ps
    SET active = false,
        ended_at = COALESCE(ps.ended_at, now()),
        audited_at = now()
    FROM s
    WHERE ps.id = s.id
  `);
}
