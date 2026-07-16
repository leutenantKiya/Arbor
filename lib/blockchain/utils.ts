// Conversion utilities between database types and on-chain types.
// Keeps all encoding logic in one place so services never handle raw hex.

import { type Hex, pad, toHex } from "viem";

// ── Contract addresses (from env, validated at import) ────────────────

export const ARBORVAULT_ADDRESS = (process.env
  .NEXT_PUBLIC_ARBORVAULT_ADDRESS ?? "") as `0x${string}`;

export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "") as `0x${string}`;

// ── USDC has 6 decimals ──────────────────────────────────────────────

const USDC_DECIMALS = 6;
const USDC_UNIT = BigInt(10 ** USDC_DECIMALS); // 1_000_000n

/**
 * Convert USDC cents (integer, database unit) to on-chain amount (6 decimals).
 * 100 cents = $1.00 = 1_000_000 on-chain units.
 */
export function centsToUsdcAmount(cents: number): bigint {
  // 1 cent = 0.01 USDC = 10_000 on-chain units
  return BigInt(cents) * (USDC_UNIT / 100n);
}

/**
 * Reverse: on-chain amount (6 decimals) → USDC cents (integer).
 */
export function usdcAmountToCents(amount: bigint): number {
  return Number(amount / (USDC_UNIT / 100n));
}

/**
 * Format on-chain USDC amount for display: 2_490_000n → "$2.49"
 */
export function formatUsdcAmount(amount: bigint): string {
  const cents = usdcAmountToCents(amount);
  return `$${(cents / 100).toFixed(2)}`;
}

// ── UUID ↔ bytes32 ───────────────────────────────────────────────────

/**
 * Convert a UUID string (e.g. "550e8400-e29b-41d4-a716-446655440000")
 * to a bytes32 hex value for on-chain use. Strips dashes and left-pads
 * the 16-byte UUID to 32 bytes.
 */
export function uuidToBytes32(uuid: string): Hex {
  const stripped = uuid.replace(/-/g, "");
  if (stripped.length !== 32) {
    throw new Error(`Invalid UUID: ${uuid}`);
  }
  return pad(`0x${stripped}` as Hex, { size: 32 });
}

/** Alias for purchase IDs */
export const purchaseIdToBytes32 = uuidToBytes32;

/** Alias for settlement IDs */
export const settlementIdToBytes32 = uuidToBytes32;

// ── Display helpers ──────────────────────────────────────────────────

/**
 * Shorten an Ethereum address for UI display: 0x1234...5678
 */
export function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
