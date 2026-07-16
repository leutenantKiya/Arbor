// On-chain event reading — used by services to verify deposits and
// confirm settlements. Uses log queries (not persistent watchers) since
// Vercel serverless functions are short-lived.

import { type Hex, decodeEventLog } from "viem";
import { arborVaultAbi } from "./abi/arborVault";
import { getPublicClient } from "./client";
import { ARBORVAULT_ADDRESS } from "./utils";

// ── Types ─────────────────────────────────────────────────────────────

export type PaymentReceivedEvent = {
  payer: `0x${string}`;
  amount: bigint;
  orderId: Hex;
};

export type CreatorPaidEvent = {
  settlementId: Hex;
  creator: `0x${string}`;
  amount: bigint;
};

export type BatchReleasedEvent = {
  settlementId: Hex;
  totalAmount: bigint;
  totalRecipients: bigint;
};

// ── Log queries ───────────────────────────────────────────────────────

/**
 * Read PaymentReceived events from a specific transaction receipt.
 * Used to verify that a deposit actually happened on-chain.
 */
export async function getPaymentReceivedFromTx(
  txHash: Hex,
): Promise<PaymentReceivedEvent | null> {
  const client = getPublicClient();
  const receipt = await client.getTransactionReceipt({ hash: txHash });

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: arborVaultAbi,
        data: log.data,
        topics: log.topics,
      });
      if (
        decoded.eventName === "PaymentReceived" &&
        log.address.toLowerCase() === ARBORVAULT_ADDRESS.toLowerCase()
      ) {
        const args = decoded.args as unknown as PaymentReceivedEvent;
        return args;
      }
    } catch {
      // Not our event — skip
    }
  }

  return null;
}

/**
 * Read BatchReleased events from a specific transaction receipt.
 * Used to confirm that a settlement was executed on-chain.
 */
export async function getBatchReleasedFromTx(
  txHash: Hex,
): Promise<BatchReleasedEvent | null> {
  const client = getPublicClient();
  const receipt = await client.getTransactionReceipt({ hash: txHash });

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: arborVaultAbi,
        data: log.data,
        topics: log.topics,
      });
      if (
        decoded.eventName === "BatchReleased" &&
        log.address.toLowerCase() === ARBORVAULT_ADDRESS.toLowerCase()
      ) {
        const args = decoded.args as unknown as BatchReleasedEvent;
        return args;
      }
    } catch {
      // Not our event — skip
    }
  }

  return null;
}

/**
 * Read CreatorPaid events from a specific transaction receipt.
 * Returns all CreatorPaid events from the settlement tx.
 */
export async function getCreatorPaidFromTx(
  txHash: Hex,
): Promise<CreatorPaidEvent[]> {
  const client = getPublicClient();
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  const events: CreatorPaidEvent[] = [];

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: arborVaultAbi,
        data: log.data,
        topics: log.topics,
      });
      if (
        decoded.eventName === "CreatorPaid" &&
        log.address.toLowerCase() === ARBORVAULT_ADDRESS.toLowerCase()
      ) {
        events.push(decoded.args as unknown as CreatorPaidEvent);
      }
    } catch {
      // Not our event — skip
    }
  }

  return events;
}
