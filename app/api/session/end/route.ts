import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { getSession } from "@/lib/auth/server";

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

    await db.execute(sql`
    UPDATE playback_sessions ps
    SET active = false, ended_at = now()
    WHERE ps.id = ${sessionId}
      AND ps.user_id = ${session.userId}
      AND ps.active = true
  `);

    return NextResponse.json({ success: true });
}