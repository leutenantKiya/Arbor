/**
 * Check the Biconomy V2 Smart Account address for a given EOA signer.
 *
 * This helps verify whether USDC was minted to the right address.
 * In Particle + Biconomy AA, the Smart Account address is different
 * from the EOA signer address.
 *
 * Usage:
 *   npx tsx scripts/check-smart-account.ts 0xEOA_ADDRESS
 */

import "dotenv/config";
import { createPublicClient, http, encodeFunctionData, getContractAddress } from "viem";
import { baseSepolia } from "viem/chains";

// Biconomy V2 Smart Account Factory on Base Sepolia
// This is the standard factory address used by Biconomy V2
const BICONOMY_FACTORY = "0x000000a56Aaca3e9a4C479ea6b6CD0DbcB6634F5" as const;

const factoryAbi = [
  {
    type: "function",
    name: "getAddressForCounterFactualAccount",
    inputs: [
      { name: "moduleSetupContract", type: "address" },
      { name: "moduleSetupData", type: "bytes" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

// Biconomy ECDSA ownership module
const ECDSA_MODULE = "0x0000001c5b32F37F5beA87BDD5374eB2aC54eA8e" as const;

const ecdsaModuleAbi = [
  {
    type: "function",
    name: "getOwner",
    inputs: [{ name: "smartAccount", type: "address" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
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

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

async function main() {
  const eoaAddress = process.argv[2] as `0x${string}`;

  if (!eoaAddress || !eoaAddress.startsWith("0x")) {
    console.log("Usage: npx tsx scripts/check-smart-account.ts 0xEOA_ADDRESS");
    console.log("\nChecking the two friend addresses instead...\n");

    const addresses = [
      "0x17B6a3177B1fcd55C9666F41dc27Edd4DdAD7D63",
      "0xc40a6874690F8Ad8EA7510aC465d4Bc21dF05d50",
    ] as `0x${string}`[];

    for (const addr of addresses) {
      await checkAddress(addr);
    }
    return;
  }

  await checkAddress(eoaAddress);
}

async function checkAddress(address: `0x${string}`) {
  console.log(`══════════════════════════════════════════`);
  console.log(`🔍 Checking: ${address}`);

  // Check USDC balance on this address
  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: [address],
  });
  console.log(`   💰 USDC balance: ${Number(balance) / 1e6} USDC`);

  // Check if this address has code (= is a smart contract/account)
  const code = await publicClient.getCode({ address });
  const isContract = code && code !== "0x";
  console.log(`   📋 Type: ${isContract ? "Smart Contract/Account ✅" : "EOA (no code deployed)"}`);

  // Try to compute the Biconomy V2 smart account for this address as signer
  try {
    const moduleSetupData = encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "initForSmartAccount",
          inputs: [{ name: "owner", type: "address" }],
          outputs: [{ name: "", type: "address" }],
          stateMutability: "nonpayable",
        },
      ],
      functionName: "initForSmartAccount",
      args: [address],
    });

    const smartAccountAddress = await publicClient.readContract({
      address: BICONOMY_FACTORY,
      abi: factoryAbi,
      functionName: "getAddressForCounterFactualAccount",
      args: [ECDSA_MODULE, moduleSetupData, 0n],
    });

    console.log(`   🔗 Biconomy V2 Smart Account: ${smartAccountAddress}`);

    // Check USDC balance on the smart account
    const saBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [smartAccountAddress as `0x${string}`],
    });
    console.log(`   💰 Smart Account USDC: ${Number(saBalance) / 1e6} USDC`);

    if (Number(saBalance) === 0 && Number(balance) > 0) {
      console.log(`   ⚠️  USDC is on the EOA, NOT on the Smart Account!`);
      console.log(`   💡 Mint USDC to ${smartAccountAddress} instead.`);
    }
  } catch (err) {
    console.log(`   ⚠️  Could not compute smart account (factory may differ)`);
  }

  console.log();
}

main().catch((err) => {
  console.error("💥 Error:", err);
  process.exit(1);
});
