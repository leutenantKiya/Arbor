import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/server";

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let recipientWalletAddress: unknown;
  let seconds: unknown;
  let socialId: unknown;
  try {
    ({ recipientWalletAddress, seconds, socialId } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Social ID resolution: @username → wallet address
  if (typeof socialId === "string" && socialId.trim()) {
    const normalized = socialId.replace(/^@/, "").trim().toLowerCase();
    if (!normalized) {
      return NextResponse.json({ error: "invalid_social_id", message: "Arbor ID not found. Check the username and try again." }, { status: 400 });
    }
    const [resolved] = await db
      .select({ walletAddress: users.walletAddress })
      .from(users)
      .where(eq(users.socialId, normalized))
      .limit(1);
    if (!resolved) {
      return NextResponse.json({ error: "social_id_not_found", message: "Arbor ID not found. Check the username and try again." }, { status: 404 });
    }
    recipientWalletAddress = resolved.walletAddress;
  }

  if (typeof recipientWalletAddress !== "string" || !WALLET_RE.test(recipientWalletAddress.trim())) {
    return NextResponse.json({ error: "invalid_wallet", message: "Invalid wallet address." }, { status: 400 });
  }

  // Self-gifting protection via wallet address comparison
  const [currentUser] = await db
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (currentUser && recipientWalletAddress && currentUser.walletAddress.toLowerCase() === (recipientWalletAddress as string).trim().toLowerCase()) {
    return NextResponse.json({ error: "cannot_gift_to_self", message: "You cannot send viewing time to yourself." }, { status: 400 });
  }

  if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds <= 0) {
    return NextResponse.json({ error: "invalid_seconds" }, { status: 400 });
  }

  const tokenHash = crypto.randomUUID();

  // One atomic statement. The recipient lookup + sender balance check + debit +
  // credit + claim insert all run inside a single implicit transaction, with
  // the sender row locked (FOR UPDATE). The earlier separate "read balance,
  // check >= seconds, then debit" path was a TOCTOU: two concurrent gifts could
  // both pass the pre-check and over-gift. Now the balance is checked under the
  // lock, so concurrent gifts serialize and can never spend more than the
  // sender holds. The debit only fires when the sender_check predicate matches.
  const result = await db.execute(sql`
    WITH recipient AS (
      SELECT u.id
      FROM users u
      WHERE u.wallet_address = ${recipientWalletAddress.trim()}
      LIMIT 1
    ),
    sender_check AS (
      SELECT u.id, u.balance_seconds
      FROM users u
      WHERE u.id = ${session.userId}
        AND u.balance_seconds >= ${seconds}
      FOR UPDATE OF u
    ),
    debit AS (
      UPDATE users u
      SET balance_seconds = u.balance_seconds - ${seconds}
      FROM sender_check sc
      WHERE u.id = sc.id
      RETURNING u.balance_seconds
    ),
    credit AS (
      UPDATE users u
      SET balance_seconds = u.balance_seconds + ${seconds}
      FROM recipient r
      WHERE u.id = r.id
        AND EXISTS (SELECT 1 FROM debit)
      RETURNING u.balance_seconds
    )
    INSERT INTO gift_claims (sender_id, recipient_id, seconds, token_hash, claimed_at)
    SELECT sc.id, r.id, ${seconds}, ${tokenHash}, now()
    FROM sender_check sc, recipient r
    WHERE EXISTS (SELECT 1 FROM debit)
    RETURNING id
  `);

  const rows = result.rows as { id: string }[];
  if (rows.length === 0) {
    // No debit happened: sender had insufficient balance (or sender ===
    // recipient resolved to the same locked row, which the balance check +
    // self-gift below already reject). Distinguish self-gift first.
    const [recipient] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.walletAddress, recipientWalletAddress.trim()))
      .limit(1);

    if (!recipient) {
      return NextResponse.json({ error: "recipient_not_found", message: "Arbor ID or wallet address not found in Arbor." }, { status: 404 });
    }
    if (recipient.id === session.userId) {
      return NextResponse.json({ error: "cannot_gift_to_self", message: "You cannot send viewing time to yourself." }, { status: 400 });
    }
    const [sender] = await db
      .select({ balanceSeconds: users.balanceSeconds })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    return NextResponse.json(
      { error: "insufficient_balance", available: sender?.balanceSeconds ?? 0 },
      { status: 403 },
    );
  }

  return NextResponse.json({ success: true, seconds });
}
