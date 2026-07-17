import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
import axios from "axios";

const projectId = process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID!;
const clientKey = process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY!;
const OWNER = "0x9f5f826B8AF7a1e58bE9ad54584B05D62a26828B";
const USDC = process.env.NEXT_PUBLIC_USDC_ADDRESS!;
const VAULT = process.env.NEXT_PUBLIC_ARBORVAULT_ADDRESS!;
const approveData = "0x095ea7b3" + VAULT.slice(2).padStart(64, "0") + (4490000).toString(16).padStart(64, "0");

const candidates = [
  { name: "BICONOMY", version: "2.0.0" },
  { name: "BICONOMY", version: "1.0.0" },
  { name: "SIMPLE", version: "1.0.0" },
  { name: "SIMPLE", version: "2.0.0" },
  { name: "LIGHT", version: "1.0.2" },
];

async function test(ac: { name: string; version: string }) {
  try {
    const res = await axios.post(
      "https://rpc.particle.network/evm-chain?method=particle_aa_getFeeQuotes",
      { method: "particle_aa_getFeeQuotes", params: [{ ...ac, ownerAddress: OWNER }, [{ to: USDC, data: approveData, value: "0x0" }]], id: 1, jsonrpc: "2.0", chainId: 11155111 },
      { auth: { username: projectId, password: clientKey } },
    );
    if (res.data.error) { console.log(`${ac.name} ${ac.version}: ❌ ${res.data.error.message?.slice(0, 70)}`); return; }
    const gasless = res.data.result?.verifyingPaymasterGasless;
    console.log(`${ac.name} ${ac.version}: ${gasless ? "✅ GASLESS OK" : "⚠️ no gasless quote"} | SA: ${res.data.result?.smartAccountAddress ?? "?"}`);
  } catch (e) { console.log(`${ac.name} ${ac.version}: HTTP ERR ${(e as any).response?.status}`); }
}

(async () => { for (const c of candidates) await test(c); })();
