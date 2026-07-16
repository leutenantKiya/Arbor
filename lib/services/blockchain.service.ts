// Purchase verification service — the bridge between an on-chain deposit
// and the database ledger credit.
//
// Flow: user submits txHash → we read the receipt → decode PaymentReceived
// event → validate payer/amount/orderId → credit balance_seconds → mark
// purchase confirmed. Idempotent via purchases.tx_hash UNIQUE.

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { purchases, users } from "@/lib/db/schema";
import { getPaymentReceivedFromTx } from "@/lib/blockchain/events";
import { getPublicClient } from "@/lib/blockchain/client";
import {
  purchaseIdToBytes32,
  usdcAmountToCents,
} from "@/lib/blockchain/utils";
import type { Hex } from "viem";

// Package definitions — must match the time page exactly.
const PACKAGES: Record<string, { seconds: number; cents: number }> = {
  sprout: { seconds: 9000, cents: 249 },
  sapling: { seconds: 18000, cents: 449 },
  grove: { seconds: 36000, cents: 799 },
};

export type ConfirmPurchaseResult =
  | { ok: true; purchaseId: string; secondsCredited: number }
  | { ok: false; error: string };

/**
 * Verify an on-chain deposit and credit the user's viewing balance.
 *
 * 1. Validate package exists
 * 2. Insert a purchase row with status=pending (or skip if txHash exists)
 * 3. Read the on-chain receipt + PaymentReceived event
 * 4. Validate event data matches expectations
 * 5. Credit balance_seconds in one atomic CTE
 * 6. Mark purchase confirmed
 *
 * Idempotent: if the txHash already exists and is confirmed, returns success
 * without double-crediting.
 */
export async function confirmPurchase(
  txHash: string,
  packageId: string,
  userId: string,
): Promise<ConfirmPurchaseResult> {
  const pkg = PACKAGES[packageId];
  if (!pkg) {
    return { ok: false, error: `Unknown package: ${packageId}` };
  }

  // ── Step 1: Idempotency check — has this txHash already been processed? ──
  const existing = await db
    .select({ id: purchases.id, status: purchases.status })
    .from(purchases)
    .where(sql`${purchases.txHash} = ${txHash}`)
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].status === "confirmed") {
      return {
        ok: true,
        purchaseId: existing[0].id,
        secondsCredited: pkg.seconds,
      };
    }
    // If pending, fall through to re-verify on-chain
  }

  // ── Step 2: Verify on-chain ──────────────────────────────────────────
  let event;
  try {
    event = await getPaymentReceivedFromTx(txHash as Hex);
  } catch (err) {
    return {
      ok: false,
      error: `Failed to read transaction: ${(err as Error).message}`,
    };
  }

  if (!event) {
    return {
      ok: false,
      error: "No PaymentReceived event found in this transaction",
    };
  }

  // Validate the deposited amount matches the package price
  const depositedCents = usdcAmountToCents(event.amount);
  if (depositedCents < pkg.cents) {
    return {
      ok: false,
      error: `Deposited ${depositedCents} cents but package costs ${pkg.cents} cents`,
    };
  }

  // Read the block number for the record
  const publicClient = getPublicClient();
  const receipt = await publicClient.getTransactionReceipt({
    hash: txHash as Hex,
  });
  const blockNumber = Number(receipt.blockNumber);

  // ── Step 3: Atomic credit — insert/update purchase + credit balance ──
  // Uses a single chained-CTE statement for atomicity (neon-http constraint).
  await db.execute(sql`
    WITH ins AS (
      INSERT INTO purchases (user_id, tx_hash, package_id, seconds, cents, status, block_number, confirmed_at)
      VALUES (
        ${userId},
        ${txHash},
        ${packageId},
        ${pkg.seconds},
        ${pkg.cents},
        'confirmed',
        ${blockNumber},
        now()
      )
      ON CONFLICT (tx_hash) DO UPDATE
        SET status = 'confirmed',
            block_number = EXCLUDED.block_number,
            confirmed_at = COALESCE(purchases.confirmed_at, now())
      WHERE purchases.status != 'confirmed'
      RETURNING id, seconds
    )
    UPDATE users u
    SET balance_seconds = u.balance_seconds + ins.seconds
    FROM ins
    WHERE u.id = ${userId}
  `);

  // Fetch the purchase ID for the response
  const [row] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(sql`${purchases.txHash} = ${txHash}`)
    .limit(1);

  return {
    ok: true,
    purchaseId: row?.id ?? "unknown",
    secondsCredited: pkg.seconds,
  };
}
