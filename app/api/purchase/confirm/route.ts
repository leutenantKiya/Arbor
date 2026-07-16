import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { confirmPurchase } from "@/lib/services/blockchain.service";

// POST /api/purchase/confirm
//
// Called by the frontend after a successful on-chain deposit.
// Reads the transaction receipt, verifies the PaymentReceived event,
// and credits the user's viewing balance.
//
// Body: { txHash: string, packageId: string }
// Auth: requires session cookie (user must be signed in)
//
// Idempotent: replaying the same txHash returns success without
// double-crediting (purchases.tx_hash UNIQUE constraint).

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const VALID_PACKAGES = ["sprout", "sapling", "grove"];

export async function POST(request: Request) {
  // ── Auth ─────────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────
  let txHash: unknown;
  let packageId: unknown;
  try {
    ({ txHash, packageId } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (typeof txHash !== "string" || !TX_HASH_RE.test(txHash)) {
    return NextResponse.json(
      { error: "invalid_tx_hash" },
      { status: 400 },
    );
  }
  if (typeof packageId !== "string" || !VALID_PACKAGES.includes(packageId)) {
    return NextResponse.json(
      { error: "invalid_package_id" },
      { status: 400 },
    );
  }

  // ── Verify on-chain + credit balance ────────────────────────────────
  const result = await confirmPurchase(txHash, packageId, session.userId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({
    success: true,
    purchaseId: result.purchaseId,
    secondsCredited: result.secondsCredited,
  });
}
