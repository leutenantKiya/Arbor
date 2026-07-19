import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, giftClaims } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/server";

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let recipientWalletAddress: unknown;
  let seconds: unknown;
  try {
    ({ recipientWalletAddress, seconds } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (typeof recipientWalletAddress !== "string" || !WALLET_RE.test(recipientWalletAddress.trim())) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds <= 0) {
    return NextResponse.json({ error: "invalid_seconds" }, { status: 400 });
  }

  const [sender] = await db
    .select({ id: users.id, balanceSeconds: users.balanceSeconds })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!sender) {
    return NextResponse.json({ error: "sender_not_found" }, { status: 401 });
  }

  if (sender.balanceSeconds < seconds) {
    return NextResponse.json(
      { error: "insufficient_balance", available: sender.balanceSeconds },
      { status: 403 },
    );
  }

  const [recipient] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.walletAddress, recipientWalletAddress.trim()))
    .limit(1);

  if (!recipient) {
    return NextResponse.json({ error: "recipient_not_found" }, { status: 404 });
  }

  if (recipient.id === sender.id) {
    return NextResponse.json({ error: "cannot_gift_to_self" }, { status: 400 });
  }

  const tokenHash = crypto.randomUUID();

  await db.execute(sql`
    WITH sender_check AS (
      SELECT u.balance_seconds
      FROM users u
      WHERE u.id = ${sender.id}
        AND u.balance_seconds >= ${seconds}
      FOR UPDATE OF u
    ),
    debit AS (
      UPDATE users u
      SET balance_seconds = u.balance_seconds - ${seconds}
      WHERE u.id = ${sender.id}
        AND EXISTS (SELECT 1 FROM sender_check)
      RETURNING u.balance_seconds
    ),
    credit AS (
      UPDATE users u
      SET balance_seconds = u.balance_seconds + ${seconds}
      WHERE u.id = ${recipient.id}
        AND EXISTS (SELECT 1 FROM debit)
      RETURNING u.balance_seconds
    )
    INSERT INTO gift_claims (sender_id, recipient_id, seconds, token_hash, claimed_at)
    SELECT ${sender.id}, ${recipient.id}, ${seconds}, ${tokenHash}, now()
    FROM debit
  `);

  return NextResponse.json({ success: true, seconds });
}
