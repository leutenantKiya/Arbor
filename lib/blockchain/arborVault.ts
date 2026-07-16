// ArborVault contract interaction layer.
//
// Read functions use the public client (anyone can call).
// releaseBatch uses the settlement wallet client (server-only, onlyOwner).

import { arborVaultAbi } from "./abi/arborVault";
import { getPublicClient, getWalletClient, arbitrumSepolia } from "./client";
import {
  ARBORVAULT_ADDRESS,
  settlementIdToBytes32,
  centsToUsdcAmount,
} from "./utils";
import type { Hex } from "viem";

// ── Read helpers ──────────────────────────────────────────────────────

/**
 * Read the USDC balance held inside the ArborVault contract.
 */
export async function getVaultBalance(): Promise<bigint> {
  const client = getPublicClient();
  return client.readContract({
    address: ARBORVAULT_ADDRESS,
    abi: arborVaultAbi,
    functionName: "getBalance",
  });
}

/**
 * Check if an order has already been fulfilled on-chain.
 */
export async function isOrderFulfilled(orderId: Hex): Promise<boolean> {
  const client = getPublicClient();
  return client.readContract({
    address: ARBORVAULT_ADDRESS,
    abi: arborVaultAbi,
    functionName: "orderFulfilled",
    args: [orderId],
  });
}

// ── Write helpers (server-only) ───────────────────────────────────────

export type ReleaseItem = {
  wallet: `0x${string}`;
  amountCents: number;
};

/**
 * Execute a batch settlement on-chain.
 *
 * 1. Converts the settlement UUID to bytes32
 * 2. Converts cents to USDC 6-decimal amounts
 * 3. Calls releaseBatch on ArborVault
 * 4. Waits for confirmation
 * 5. Returns the tx hash
 *
 * This MUST only be called server-side (uses SETTLEMENT_PRIVATE_KEY).
 */
export async function releaseBatch(
  settlementId: string,
  items: ReleaseItem[],
): Promise<{ txHash: Hex; blockNumber: bigint }> {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();

  const settlementBytes32 = settlementIdToBytes32(settlementId);

  const onChainItems = items.map((item) => ({
    wallet: item.wallet,
    amount: centsToUsdcAmount(item.amountCents),
  }));

  // Send the settlement transaction
  const txHash = await walletClient.writeContract({
    address: ARBORVAULT_ADDRESS,
    abi: arborVaultAbi,
    functionName: "releaseBatch",
    args: [settlementBytes32, onChainItems],
    chain: arbitrumSepolia,
    account: walletClient.account!,
  });

  // Wait for on-chain confirmation
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  if (receipt.status === "reverted") {
    throw new Error(
      `Settlement transaction reverted: ${txHash}`,
    );
  }

  return {
    txHash,
    blockNumber: receipt.blockNumber,
  };
}
