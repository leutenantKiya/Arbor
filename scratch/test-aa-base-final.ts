import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
import axios from "axios";

const projectId = process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID!;
const clientKey = process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY!;
const OWNER = "0x9f5f826B8AF7a1e58bE9ad54584B05D62a26828B";
const USDC = "0x6ad53b501be028a86db2b67d7af2a16a90a7a287";
const VAULT = "0x88b43fa638fb3a6affa8d46692dba0558bafb3df";
const approveData = "0x095ea7b3" + VAULT.slice(2).padStart(64, "0") + (4490000).toString(16).padStart(64, "0");

(async () => {
  const res = await axios.post(
    "https://rpc.particle.network/evm-chain?method=particle_aa_getFeeQuotes",
    { method: "particle_aa_getFeeQuotes", params: [{ name: "BICONOMY", version: "2.0.0", ownerAddress: OWNER }, [{ to: USDC, data: approveData, value: "0x0" }]], id: 1, jsonrpc: "2.0", chainId: 84532 },
    { auth: { username: projectId, password: clientKey } },
  );
  if (res.data.error) { console.log("❌", res.data.error.message?.slice(0, 100)); return; }
  const r = res.data.result;
  console.log("smart account:", r?.smartAccountAddress ?? JSON.stringify(Object.keys(r)));
  console.log("gasless:", r?.verifyingPaymasterGasless ? "✅ PAYMASTER SPONSOR — approve di USDC baru DISETUJUI" : "❌ null");
})();
