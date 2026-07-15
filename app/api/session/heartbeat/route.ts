import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { getSession } from "@/lib/auth/server";

// Server-clock delta cap: heartbeat interval (10s) + 2s network tolerance
// (ARCHITECTURE.md §4.1 / §8 "Heartbeat inflation/replay").
const MAX_DELTA_SECONDS = 12;

// Billing rate: 10 seconds watched = 1 cent total, filmmaker keeps 90%.
// Expressed inline in the SQL below as ROUND(debited * 0.9 / 10.0).

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let sessionId: unknown;
  let seq: unknown;
  try {
    ({ sessionId, seq } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (
    typeof sessionId !== "string" ||
    !UUID_RE.test(sessionId) ||
    typeof seq !== "number" ||
    !Number.isInteger(seq) ||
    seq <= 0
  ) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // One atomic statement — chained data-modifying CTEs run as a single
  // implicit transaction, which is the only transaction shape the neon-http
  // driver supports. FOR UPDATE locks the session + ledger rows first, so a
  // concurrent duplicate beat blocks, re-evaluates seq > last_seq against
  // the committed row, and matches zero rows instead of double-billing.
  //
  // target  → validate owner / active / monotonic seq, lock rows, read
  //           raw delta from the server clock (never the client's claim)
  // calc    → cap the debit at both MAX_DELTA and the remaining balance
  // beat    → advance last_seq/last_beat_at; auto-end the session in the
  //           same UPDATE when the balance hits 0 (a row must not be
  //           updated twice by different CTEs of one statement)
  // debit   → decrement users.balance_seconds
  // event   → append-only debit_events audit row
  // accrue  → filmmaker's 90% share onto filmmakers.pending_cents
  const result = await db.execute(sql`
    WITH target AS (
      SELECT ps.id AS session_id, ps.user_id, ps.film_id,
             u.balance_seconds,
             LEAST(${MAX_DELTA_SECONDS}, GREATEST(0,
               EXTRACT(EPOCH FROM (now() - COALESCE(ps.last_beat_at, ps.started_at)))::int
             )) AS raw_delta
      FROM playback_sessions ps
      JOIN users u ON u.id = ps.user_id
      WHERE ps.id = ${sessionId}
        AND ps.user_id = ${session.userId}
        AND ps.active = true
        AND ${seq} > ps.last_seq
      FOR UPDATE OF ps, u
    ),
    calc AS (
      SELECT t.*,
             LEAST(t.raw_delta, t.balance_seconds) AS debited,
             ROUND(LEAST(t.raw_delta, t.balance_seconds) * 0.9 / 10.0)::int AS filmmaker_cents
      FROM target t
    ),
    beat AS (
      UPDATE playback_sessions ps
      SET last_seq = ${seq},
          last_beat_at = now(),
          active   = CASE WHEN c.balance_seconds - c.debited <= 0 THEN false ELSE ps.active END,
          ended_at = CASE WHEN c.balance_seconds - c.debited <= 0 THEN now() ELSE ps.ended_at END
      FROM calc c
      WHERE ps.id = c.session_id
      RETURNING ps.id
    ),
    debit AS (
      UPDATE users u
      SET balance_seconds = u.balance_seconds - c.debited
      FROM calc c
      WHERE u.id = c.user_id
      RETURNING u.balance_seconds
    ),
    event AS (
      INSERT INTO debit_events (session_id, seconds, filmmaker_cents)
      SELECT c.session_id, c.debited, c.filmmaker_cents
      FROM calc c
      WHERE c.debited > 0
      RETURNING id
    ),
    accrue AS (
      UPDATE filmmakers f
      SET pending_cents = f.pending_cents + c.filmmaker_cents
      FROM calc c
      JOIN films fl ON fl.id = c.film_id
      WHERE f.id = fl.filmmaker_id AND c.filmmaker_cents > 0
      RETURNING f.id
    )
    SELECT c.debited AS debited_seconds,
           c.balance_seconds - c.debited AS remaining_seconds,
           (c.balance_seconds - c.debited <= 0) AS session_ended
    FROM calc c
  `);

  const row = result.rows[0] as
    | {
      debited_seconds: number;
      remaining_seconds: number;
      session_ended: boolean;
    }
    | undefined;

  // No row = the WHERE failed: wrong owner, inactive/unknown session, or a
  // replayed/out-of-order seq. All are non-billable; the client should stop
  // this loop and start a fresh session if the user is still watching.
  if (!row) {
    return NextResponse.json({ error: "rejected" }, { status: 409 });
  }

  return NextResponse.json({
    success: true,
    debitedSeconds: Number(row.debited_seconds),
    remainingSeconds: Number(row.remaining_seconds),
    sessionEnded: row.session_ended,
  });
}