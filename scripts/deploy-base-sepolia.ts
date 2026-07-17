// Deploy MockUSDC + ArborSettlement to Base Sepolia.
// Run: npx tsx scripts/deploy-base-sepolia.ts
// Needs SETTLEMENT_PRIVATE_KEY in .env (burner wallet, faucet-funded).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });
import { readFileSync } from "fs";
import { join } from "path";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// Smart account of the existing test user (from Particle) — gets seed USDC.
const TEST_SMART_ACCOUNT = "0xB4164F4cf1adc343416b905D767100c4C13020f2";
const SEED_USDC = 1_000_000_000n; // 1000 USDC (6 decimals)

function compile() {
  const sources: Record<string, { content: string }> = {};
  for (const name of ["MockUSDC.sol", "ArborSettlement.sol"]) {
    sources[name] = {
      content: readFileSync(join(process.cwd(), "contracts", name), "utf8"),
    };
  }
  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter((e: any) => e.severity === "error");
  if (errors.length) {
    for (const e of errors) console.error(e.formattedMessage);
    process.exit(1);
  }
  return {
    usdc: out.contracts["MockUSDC.sol"].MockUSDC,
    vault: out.contracts["ArborSettlement.sol"].ArborSettlement,
  };
}

async function main() {
  let pk = (process.env.SETTLEMENT_PRIVATE_KEY || "").trim().replace(/^"|"$/g, "");
  if (!pk.startsWith("0x")) pk = "0x" + pk;
  const account = privateKeyToAccount(pk as `0x${string}`);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http() });

  console.log("deployer:", account.address);
  console.log("balance:", formatEther(await publicClient.getBalance({ address: account.address })), "ETH");

  console.log("\ncompiling…");
  const { usdc, vault } = compile();

  console.log("deploying MockUSDC…");
  const usdcTx = await walletClient.deployContract({
    abi: usdc.abi,
    bytecode: `0x${usdc.evm.bytecode.object}`,
  });
  const usdcReceipt = await publicClient.waitForTransactionReceipt({ hash: usdcTx });
  const usdcAddr = usdcReceipt.contractAddress!;
  console.log("MockUSDC:", usdcAddr);

  console.log("deploying ArborSettlement…");
  const vaultTx = await walletClient.deployContract({
    abi: vault.abi,
    bytecode: `0x${vault.evm.bytecode.object}`,
    args: [usdcAddr],
  });
  const vaultReceipt = await publicClient.waitForTransactionReceipt({ hash: vaultTx });
  const vaultAddr = vaultReceipt.contractAddress!;
  console.log("ArborSettlement:", vaultAddr);

  console.log("\nseeding test user with USDC…");
  const mintTx = await walletClient.writeContract({
    address: usdcAddr,
    abi: parseAbi(["function mint(address to, uint256 amount)"]),
    functionName: "mint",
    args: [TEST_SMART_ACCOUNT, SEED_USDC],
  });
  await publicClient.waitForTransactionReceipt({ hash: mintTx });
  console.log(`minted 1000 USDC → ${TEST_SMART_ACCOUNT}`);

  console.log("\nverifying…");
  const linkedUsdc = await publicClient.readContract({
    address: vaultAddr,
    abi: parseAbi(["function USDC() view returns (address)"]),
    functionName: "USDC",
  });
  const vaultOwner = await publicClient.readContract({
    address: vaultAddr,
    abi: parseAbi(["function owner() view returns (address)"]),
    functionName: "owner",
  });
  console.log("vault.USDC():", linkedUsdc, linkedUsdc.toLowerCase() === usdcAddr.toLowerCase() ? "✓" : "✗ MISMATCH");
  console.log("vault.owner():", vaultOwner, vaultOwner.toLowerCase() === account.address.toLowerCase() ? "✓" : "✗ MISMATCH");

  console.log("\n=== PASTE INTO .env ===");
  console.log(`NEXT_PUBLIC_CHAIN="base-sepolia"`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS="${usdcAddr}"`);
  console.log(`NEXT_PUBLIC_ARBORVAULT_ADDRESS="${vaultAddr}"`);
}

main().catch((e) => {
  console.error(e.message?.slice(0, 300));
  process.exit(1);
});
