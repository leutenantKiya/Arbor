import { config as loadEnv } from "dotenv";
import axios from "axios";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const projectId = process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID;
const clientKey = process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY;

if (!projectId || !clientKey) {
  console.error("Missing Particle credentials in .env");
  process.exit(1);
}

const ownerAddress = "0x77249c24049c52aF6563804DBf0388d091A11023"; // dummy EOA

const mockTx = {
  to: "0x7E2D75D20cc7dCf3FE7ecC0d6D3d99A7960B6f12",
  data: "0x095ea7b3000000000000000000000000a2724ddb354b0c21d3c6c5d648fbb3cf16b818e00000000000000000000000000000000000000000000000000000000000448310",
  value: "0x0",
};

const accountConfig = {
  name: "BICONOMY",
  version: "2.0.0",
  ownerAddress,
};

// Chains to test:
// 11155111 = Ethereum Sepolia
// 84532 = Base Sepolia
// 421614 = Arbitrum Sepolia
const testChains = [
  { id: 11155111, name: "Ethereum Sepolia" },
  { id: 84532, name: "Base Sepolia" },
  { id: 421614, name: "Arbitrum Sepolia" },
];

async function testChain(chainId: number, name: string) {
  console.log(`\nTesting Chain: ${name} (${chainId})...`);
  try {
    const url = `https://rpc.particle.network/evm-chain?method=particle_aa_getFeeQuotes`;
    const response = await axios.post(
      url,
      {
        method: "particle_aa_getFeeQuotes",
        params: [accountConfig, [mockTx]],
        id: 1,
        jsonrpc: "2.0",
      },
      {
        params: {
          chainId,
          projectUuid: projectId,
          projectKey: clientKey,
        },
      }
    );

    if (response.data.error) {
      console.log(`❌ Error:`, response.data.error);
    } else {
      console.log(`✅ Success! Fee Quotes received!`);
    }
  } catch (err) {
    console.error(`❌ HTTP Error:`, (err as any).message);
  }
}

async function run() {
  for (const chain of testChains) {
    await testChain(chain.id, chain.name);
  }
}

run();
