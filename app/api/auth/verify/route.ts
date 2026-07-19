import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/auth/session";
import { verifyParticleUser } from "@/lib/particle/server";
import { DEV_SEED_BALANCE_SECONDS } from "@/lib/billing";
import { isUserFilmmaker } from "@/lib/db/queries";

const bodySchema = z.object({
  uuid: z.string().min(1),
  token: z.string().min(1),
  walletAddress: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { uuid, token, walletAddress } = parsed.data;

  // Proves the client's Particle session is real before we ever touch the
  // ledger or issue a cookie (ARCHITECTURE.md §8).
  try {
    await verifyParticleUser(uuid, token);
  } catch {
    return NextResponse.json({ error: "Could not verify session" }, { status: 401 });
  }

  const db = getDb();
  const [user] = await db
    .insert(schema.users)
    // TODO(purchase-flow): drop balanceSeconds here — dev seed only, so a
    // brand-new Particle user has watch time before the purchase flow exists.
    // onConflictDoUpdate deliberately does NOT touch balanceSeconds, so an
    // existing user's balance is never reset on re-login.
    .values({ particleUuid: uuid, walletAddress, balanceSeconds: DEV_SEED_BALANCE_SECONDS })
    .onConflictDoUpdate({
      target: schema.users.particleUuid,
      set: { walletAddress },
    })
    .returning();

  const jwt = await signSession({
    userId: user.id,
    particleUuid: user.particleUuid,
    walletAddress: user.walletAddress,
  });

  // Client needs this to decide whether /studio requires a full reload
  // (filmmaker dashboard vs. creator application view) or just a Nav refresh.
  const isFilmmaker = await isUserFilmmaker(user.id);

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, balanceSeconds: user.balanceSeconds },
    isFilmmaker,
  });
  response.cookies.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
