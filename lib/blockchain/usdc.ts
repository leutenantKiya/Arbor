// USDC ERC20 read helpers — balance and allowance checks.
// Write operations (approve) happen client-side via Particle's embedded wallet.

import { erc20Abi } from "./abi/erc20";
import { getPublicClient } from "./client";
import { USDC_ADDRESS } from "./utils";

/**
 * Read USDC balance for an address (returns raw 6-decimal amount).
 */
export async function getUsdcBalance(
  address: `0x${string}`,
): Promise<bigint> {
  const client = getPublicClient();
  return client.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
}

/**
 * Read current USDC allowance from `owner` to `spender`.
 */
export async function getUsdcAllowance(
  owner: `0x${string}`,
  spender: `0x${string}`,
): Promise<bigint> {
  const client = getPublicClient();
  return client.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });
}
