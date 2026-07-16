// Settlement service — orchestrates the daily filmmaker payout.
//
// Two-phase settlement (ARCHITECTURE.md §4.3):
//   Phase 1 (DB): snapshot filmmakers with pending_cents >= threshold,
//                 create settlement + items, zero accruals.
//   Phase 2 (chain): call releaseBatch(), store txHash, wait confirmation,
//                    mark completed.
//
// Exactly-once by construction:
//   - settlements.id is the idempotency key
//   - status=pending → only one in-flight settlement at a time
//   - retry checks for existing pending settlements before creating new ones

import { sql, gt, isNull, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  filmmakers,
  settlements,
  settlementItems,
} from "@/lib/db/schema";
import {
  releaseBatch,
  type ReleaseItem,
} from "@/lib/blockchain/arborVault";
import { getBatchReleasedFromTx } from "@/lib/blockchain/events";
import type { Hex } from "viem";

// Minimum payout threshold in cents. Filmmakers below this are skipped
// and their pending_cents accumulate until the next settlement.
const MIN_PAYOUT_CENTS = 100; // $1.00

export type SettlementResult =
  | {
      ok: true;
      settlementId: string;
      txHash: string;
      totalCents: number;
      filmmakerCount: number;
    }
  | { ok: false; reason: string };

/**
 * Run a full settlement cycle:
 * 1. Check for stuck pending settlements → retry those first
 * 2. Snapshot filmmakers with enough accrued earnings
 * 3. Create settlement + items in DB, zero accruals (Phase 1)
 * 4. Execute releaseBatch on-chain (Phase 2)
 * 5. Confirm and mark completed
 */
export async function runSettlement(): Promise<SettlementResult> {
  // ── Retry stuck settlements first ───────────────────────────────────
  const stuck = await retryPendingSettlements();
  if (stuck) return stuck;

  // ── Phase 1: DB snapshot ────────────────────────────────────────────
  const eligible = await db
    .select({
      id: filmmakers.id,
      name: filmmakers.name,
      walletAddress: filmmakers.walletAddress,
      pendingCents: filmmakers.pendingCents,
    })
    .from(filmmakers)
    .where(gt(filmmakers.pendingCents, MIN_PAYOUT_CENTS - 1));

  // Filter out filmmakers with zero/placeholder wallets
  const payable = eligible.filter(
    (f) =>
      f.walletAddress &&
      f.walletAddress !== "0x0000000000000000000000000000000000000000",
  );

  if (payable.length === 0) {
    return { ok: false, reason: "No filmmakers eligible for settlement" };
  }

  const totalCents = payable.reduce((sum, f) => sum + f.pendingCents, 0);

  // Create settlement + items + zero accruals in one atomic CTE.
  // neon-http supports chained CTEs as a single implicit transaction.
  const filmmakerIds = payable.map((f) => f.id);
  const settlementResult = await db.execute(sql`
    WITH new_settlement AS (
      INSERT INTO settlements (total_cents, status)
      VALUES (${totalCents}, 'pending')
      RETURNING id
    ),
    items AS (
      INSERT INTO settlement_items (settlement_id, filmmaker_id, cents, wallet_address, status)
      SELECT
        (SELECT id FROM new_settlement),
        f.id,
        f.pending_cents,
        f.wallet_address,
        'pending'
      FROM filmmakers f
      WHERE f.id = ANY(${filmmakerIds})
        AND f.pending_cents > 0
      RETURNING settlement_id
    ),
    zero AS (
      UPDATE filmmakers f
      SET pending_cents = 0
      WHERE f.id = ANY(${filmmakerIds})
        AND f.pending_cents > 0
      RETURNING f.id
    )
    SELECT id FROM new_settlement
  `);

  const settlementId = (settlementResult.rows[0] as { id: string })?.id;
  if (!settlementId) {
    return { ok: false, reason: "Failed to create settlement record" };
  }

  // ── Phase 2: On-chain execution ─────────────────────────────────────
  return executeSettlementOnChain(settlementId, payable);
}

/**
 * Execute a settlement that already exists in the DB (Phase 2 only).
 * Used for both fresh settlements and retries of stuck ones.
 */
async function executeSettlementOnChain(
  settlementId: string,
  items: Array<{
    id: string;
    walletAddress: string;
    pendingCents: number;
  }>,
): Promise<SettlementResult> {
  const releaseItems: ReleaseItem[] = items.map((f) => ({
    wallet: f.walletAddress as `0x${string}`,
    amountCents: f.pendingCents,
  }));

  const totalCents = items.reduce((sum, f) => sum + f.pendingCents, 0);

  try {
    const { txHash } = await releaseBatch(settlementId, releaseItems);

    // Store txHash immediately (crash between here and confirmation =
    // recoverable: we have the hash to check on retry)
    await db.execute(sql`
      UPDATE settlements
      SET tx_hash = ${txHash}
      WHERE id = ${settlementId}
    `);

    // Verify the BatchReleased event
    const batchEvent = await getBatchReleasedFromTx(txHash);
    if (!batchEvent) {
      // Tx confirmed but no event — contract may have reverted silently
      await db.execute(sql`
        UPDATE settlements
        SET status = 'failed'
        WHERE id = ${settlementId}
      `);
      return { ok: false, reason: "Settlement tx confirmed but no BatchReleased event" };
    }

    // Mark settlement as completed
    await db.execute(sql`
      UPDATE settlements
      SET status = 'completed',
          confirmed_at = now()
      WHERE id = ${settlementId}
    `);

    // Mark all settlement items as paid
    await db.execute(sql`
      UPDATE settlement_items
      SET status = 'paid'
      WHERE settlement_id = ${settlementId}
    `);

    return {
      ok: true,
      settlementId,
      txHash,
      totalCents,
      filmmakerCount: items.length,
    };
  } catch (err) {
    console.error(`[settlement] releaseBatch failed for ${settlementId}:`, err);
    return {
      ok: false,
      reason: `On-chain settlement failed: ${(err as Error).message}`,
    };
  }
}

/**
 * Check for settlements stuck in 'pending' status (Phase 1 done, Phase 2
 * crashed). If found, retry the on-chain execution.
 *
 * Returns a SettlementResult if a stuck settlement was found and retried,
 * or null if none exist.
 */
async function retryPendingSettlements(): Promise<SettlementResult | null> {
  const pending = await db
    .select({
      id: settlements.id,
      txHash: settlements.txHash,
    })
    .from(settlements)
    .where(
      sql`${settlements.status} = 'pending'`,
    )
    .limit(1);

  if (pending.length === 0) return null;

  const stuck = pending[0];

  // If we already have a txHash, the transaction was sent — check if it
  // confirmed on-chain before resending
  if (stuck.txHash) {
    try {
      const batchEvent = await getBatchReleasedFromTx(stuck.txHash as Hex);
      if (batchEvent) {
        // Already confirmed! Just update the DB.
        await db.execute(sql`
          UPDATE settlements
          SET status = 'completed', confirmed_at = now()
          WHERE id = ${stuck.id}
        `);
        await db.execute(sql`
          UPDATE settlement_items
          SET status = 'paid'
          WHERE settlement_id = ${stuck.id}
        `);
        return {
          ok: true,
          settlementId: stuck.id,
          txHash: stuck.txHash,
          totalCents: 0,
          filmmakerCount: 0,
        };
      }
    } catch {
      // Tx not found or reverted — fall through to re-execute
    }
  }

  // Load the settlement items to re-execute
  const items = await db
    .select({
      id: settlementItems.filmmakerId,
      walletAddress: settlementItems.walletAddress,
      pendingCents: settlementItems.cents,
    })
    .from(settlementItems)
    .where(eq(settlementItems.settlementId, stuck.id));

  if (items.length === 0) {
    return { ok: false, reason: "Stuck settlement has no items" };
  }

  return executeSettlementOnChain(stuck.id, items);
}
