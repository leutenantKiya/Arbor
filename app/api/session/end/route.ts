import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { playbackSessions } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/server";
import { rollupSession } from "@/lib/db/rollup";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Idempotent close — called on pause/ended/unmount, and via
// navigator.sendBeacon on page unload (beacon posts a JSON blob, which
// request.json() parses the same as a normal fetch).
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let sessionId: unknown;
  try {
    ({ sessionId } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof sessionId !== "string" || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Verify ownership before rolling up. We do NOT require active=true here:
  // if the session was already flipped inactive (e.g. exhaustion) but not yet
  // audited, this still finishes the rollup. rollupSession itself is a no-op
  // once audited_at is set, so a repeated /end is harmless.
  const [owned] = await db
    .select({ id: playbackSessions.id })
    .from(playbackSessions)
    .where(
      and(
        eq(playbackSessions.id, sessionId),
        eq(playbackSessions.userId, session.userId),
      ),
    );

  if (owned) {
    await rollupSession(sessionId);
  }

  return NextResponse.json({ success: true });
}
