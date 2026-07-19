/**
 * Mint (or transfer) testnet USDC to friend addresses.
 *
 * Works regardless of whether the recipient is an EOA or a Smart Account —
 * ERC20 transfer/mint doesn't care about the target address type.
 *
 * Usage:
 *   npx tsx scripts/mint-usdc.ts
 *
 * Prerequisites:
 *   - .env must have SETTLEMENT_PRIVATE_KEY, NEXT_PUBLIC_USDC_ADDRESS
 *   - Settlement wallet must have USDC balance (for transfer mode)
 *     OR be the USDC contract owner (for mint mode)
 */

import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ── Config ────────────────────────────────────────────────────────────

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
const rawKey = process.env.SETTLEMENT_PRIVATE_KEY ?? "";
const PRIVATE_KEY = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;

// 👇 Smart Account addresses (computed from EOA via Biconomy V2 factory)
const RECIPIENTS: { address: `0x${string}`; amount: string }[] = [
  {
    address: "0xaF9D27d99125715D927A4807EA8bfAb45bCD63d1",  // temen 1 (EOA: 0x17B6...7D63)
    amount: "100",                                           // 100 USDC
  },
  {
    address: "0xAA9A10D3237427b3027a7AAd3169C604DcCf0784",  // temen 2 (EOA: 0xc40a...d50)
    amount: "100",                                           // 100 USDC
  },
  {
    address: "0x840a0ec90A96fD58f62c7D89Cd2dB18C173048Bc",  // temen 3 (signer: 0xB5E2...5E8A)
    amount: "100",                                           // 100 USDC
  },
];

// ── ABI fragments ─────────────────────────────────────────────────────

const erc20TransferAbi = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

// If your testnet USDC has a mint function (common for test tokens)
const erc20MintAbi = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ── Setup clients ─────────────────────────────────────────────────────

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log("🌿 Arbor USDC Distribution Script");
  console.log("══════════════════════════════════════════");
  console.log(`📋 Chain:         Base Sepolia`);
  console.log(`💰 USDC Contract: ${USDC_ADDRESS}`);
  console.log(`🔑 Sender:        ${account.address}`);
  console.log();

  // Check sender balance first
  const senderBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(
    `💳 Sender USDC balance: ${Number(senderBalance) / 1e6} USDC\n`,
  );

  // ── Try mint first, fall back to transfer ───────────────────────────
  let useMint = false;

  try {
    // Simulate a mint to see if we have mint permissions
    await publicClient.simulateContract({
      address: USDC_ADDRESS,
      abi: erc20MintAbi,
      functionName: "mint",
      args: [RECIPIENTS[0].address, parseUnits("1", 6)],
      account: account.address,
    });
    useMint = true;
    console.log("✅ Mint function available — will mint directly\n");
  } catch {
    console.log(
      "ℹ️  No mint access — will use transfer from sender wallet\n",
    );
  }

  // ── Process each recipient ──────────────────────────────────────────

  for (const recipient of RECIPIENTS) {
    const amountRaw = parseUnits(recipient.amount, 6); // USDC = 6 decimals
    console.log(
      `📤 Sending ${recipient.amount} USDC → ${recipient.address}`,
    );

    let txHash: Hex;

    if (useMint) {
      txHash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: erc20MintAbi,
        functionName: "mint",
        args: [recipient.address, amountRaw],
        chain: baseSepolia,
        account,
      });
    } else {
      txHash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: erc20TransferAbi,
        functionName: "transfer",
        args: [recipient.address, amountRaw],
        chain: baseSepolia,
        account,
      });
    }

    console.log(`   ⏳ Tx: ${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

    if (receipt.status === "reverted") {
      console.log(`   ❌ REVERTED!`);
    } else {
      console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
    }

    // Show updated balance
    const newBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [recipient.address],
    });
    console.log(
      `   💰 ${recipient.address} now has ${Number(newBalance) / 1e6} USDC\n`,
    );
  }

  console.log("══════════════════════════════════════════");
  console.log("🎉 Done!");
}

main().catch((err) => {
  console.error("💥 Error:", err);
  process.exit(1);
});
