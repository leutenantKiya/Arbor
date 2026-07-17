// viem clients for Ethereum Sepolia.
//
// Public client: reading contract state, watching events, confirming txs.
//   Used by both server and client code.
//
// Wallet client: server-only, for settlement releaseBatch() calls.
//   Derives from SETTLEMENT_PRIVATE_KEY env var.

import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ── Public client (singleton) ─────────────────────────────────────────

let _publicClient: PublicClient | null = null;

export function getPublicClient(): PublicClient {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: sepolia,
      transport: http(),
    });
  }
  return _publicClient;
}

// ── Wallet client (server-only, singleton) ────────────────────────────

let _walletClient: WalletClient | null = null;

/**
 * Returns a wallet client for settlement transactions.
 * MUST only be called server-side — reads SETTLEMENT_PRIVATE_KEY.
 * Throws if the key is not set.
 */
export function getWalletClient(): WalletClient {
  if (!_walletClient) {
    const key = process.env.SETTLEMENT_PRIVATE_KEY;
    if (!key) {
      throw new Error(
        "SETTLEMENT_PRIVATE_KEY is not set — see .env.example. " +
          "This key is required for on-chain settlement.",
      );
    }
    const account = privateKeyToAccount(key as `0x${string}`);
    _walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    });
  }
  return _walletClient;
}

// Re-export the chain for convenience
export { sepolia };
