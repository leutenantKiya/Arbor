import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
import axios from "axios";

const projectId = process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID!;
const clientKey = process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY!;
const OWNER = "0x9f5f826B8AF7a1e58bE9ad54584B05D62a26828B";
// plain 0-value self-transfer — no contract involved, pure paymaster health check
const tx = { to: OWNER, data: "0x", value: "0x0" };

const chains = [
  { id: 11155111, name: "Ethereum Sepolia" },
  { id: 84532, name: "Base Sepolia" },
  { id: 421614, name: "Arbitrum Sepolia" },
  { id: 11155420, name: "Optimism Sepolia" },
];

async function test(c: { id: number; name: string }) {
  try {
    const res = await axios.post(
      "https://rpc.particle.network/evm-chain?method=particle_aa_getFeeQuotes",
      { method: "particle_aa_getFeeQuotes", params: [{ name: "BICONOMY", version: "2.0.0", ownerAddress: OWNER }, [tx]], id: 1, jsonrpc: "2.0", chainId: c.id },
      { auth: { username: projectId, password: clientKey } },
    );
    if (res.data.error) { console.log(`${c.name} (${c.id}): ❌ ${res.data.error.message?.slice(0, 60)}`); return; }
    const gasless = res.data.result?.verifyingPaymasterGasless;
    console.log(`${c.name} (${c.id}): ${gasless ? "✅ GASLESS SEHAT" : "⚠️ quote ada tapi gasless null"}`);
  } catch (e) { console.log(`${c.name}: HTTP ${(e as any).response?.status}`); }
}

(async () => { for (const c of chains) await test(c); })();
