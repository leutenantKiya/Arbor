// viem clients for Base Sepolia.
//
// Public client: reading contract state, watching events, confirming txs.
//   Used by both server and client code.
//
// Wallet client: server-only, for settlement releaseBatch() calls.
//   Derives from SETTLEMENT_PRIVATE_KEY env var.

import { createPublicClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// NOTE: no explicit PublicClient/WalletClient annotations — baseSepolia is an
// OP-Stack chain with custom formatters (deposit transactions), so the created
// clients are richer than viem's plain client types and the annotation would
// fail to typecheck. Inference keeps the full chain-specific type.

// ── Public client (singleton) ─────────────────────────────────────────

function makePublicClient() {
  return createPublicClient({ chain: baseSepolia, transport: http() });
}

let _publicClient: ReturnType<typeof makePublicClient> | null = null;

export function getPublicClient() {
  if (!_publicClient) {
    _publicClient = makePublicClient();
  }
  return _publicClient;
}

// ── Wallet client (server-only, singleton) ────────────────────────────

function makeWalletClient() {
  const key = process.env.SETTLEMENT_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "SETTLEMENT_PRIVATE_KEY is not set — see .env.example. " +
        "This key is required for on-chain settlement.",
    );
  }
  const account = privateKeyToAccount(key as `0x${string}`);
  return createWalletClient({ account, chain: baseSepolia, transport: http() });
}

let _walletClient: ReturnType<typeof makeWalletClient> | null = null;

/**
 * Returns a wallet client for settlement transactions.
 * MUST only be called server-side — reads SETTLEMENT_PRIVATE_KEY.
 * Throws if the key is not set.
 */
export function getWalletClient() {
  if (!_walletClient) {
    _walletClient = makeWalletClient();
  }
  return _walletClient;
}

// Re-export the chain for convenience
export { baseSepolia };
