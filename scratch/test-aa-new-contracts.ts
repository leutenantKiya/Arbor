// Probe Particle AA gasless sponsorship on eth-sepolia with the NEW contracts.
// Mirrors scratch/test-particle-aa.ts but: real owner EOA, real USDC approve.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });
import axios from "axios";
import { encodeFunctionData, parseAbi } from "viem";

const projectId = process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID!;
const clientKey = process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY!;

const OWNER_EOA = "0x9f5f826B8AF7a1e58bE9ad54584B05D62a26828B"; // user's Particle EOA (from DB)
const USDC = process.env.NEXT_PUBLIC_USDC_ADDRESS!;
const VAULT = process.env.NEXT_PUBLIC_ARBORVAULT_ADDRESS!;

const approveData = encodeFunctionData({
  abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
  functionName: "approve",
  args: [VAULT as `0x${string}`, 4490000n],
});

async function main() {
  console.log("chain: 11155111 | USDC:", USDC, "| VAULT:", VAULT);
  try {
    const res = await axios.post(
      "https://rpc.particle.network/evm-chain?method=particle_aa_getFeeQuotes",
      {
        method: "particle_aa_getFeeQuotes",
        params: [
          { name: "BICONOMY", version: "2.0.0", ownerAddress: OWNER_EOA },
          [{ to: USDC, data: approveData, value: "0x0" }],
        ],
        id: 1,
        jsonrpc: "2.0",
        chainId: 11155111,
      },
      { auth: { username: projectId, password: clientKey } },
    );
    const r = res.data;
    if (r.error) {
      console.log("❌", JSON.stringify(r.error, null, 1).slice(0, 500));
      return;
    }
    const gasless = r.result?.verifyingPaymasterGasless;
    const smartAccount = r.result?.smartAccountAddress ?? "(n/a)";
    console.log("smart account:", smartAccount);
    console.log("gasless available:", gasless ? "✅ YA — paymaster mau sponsor" : "❌ TIDAK");
    if (gasless) console.log("gasless quote keys:", Object.keys(gasless));
  } catch (e: any) {
    console.log("HTTP ERR:", e.response?.status, JSON.stringify(e.response?.data ?? e.message).slice(0, 400));
  }
}
main();
