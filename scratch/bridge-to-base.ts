import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
import { createPublicClient, createWalletClient, http, formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia, baseSepolia } from "viem/chains";

// Base Sepolia L1StandardBridge on Ethereum Sepolia — verified from
// docs.base.org/base-chain/network-information/base-contracts
const L1_BRIDGE = "0x49f53e41452C74589E85cA1677426Ba426459e85";

async function main() {
  let pk = (process.env.SETTLEMENT_PRIVATE_KEY || "").trim().replace(/^"|"$/g, "");
  if (!pk.startsWith("0x")) pk = "0x" + pk;
  const account = privateKeyToAccount(pk as `0x${string}`);
  const l1 = createPublicClient({ chain: sepolia, transport: http() });
  const l2 = createPublicClient({ chain: baseSepolia, transport: http() });
  const wallet = createWalletClient({ account, chain: sepolia, transport: http() });

  console.log("burner:", account.address);
  console.log("L1 (eth-sepolia):", formatEther(await l1.getBalance({ address: account.address })), "ETH");
  console.log("L2 (base-sepolia) before:", formatEther(await l2.getBalance({ address: account.address })), "ETH");

  const hash = await wallet.sendTransaction({
    to: L1_BRIDGE,
    value: parseEther("0.02"),
    gas: 300000n,
  });
  console.log("bridge tx:", hash);
  const receipt = await l1.waitForTransactionReceipt({ hash });
  console.log("L1 status:", receipt.status);
  console.log("nunggu L2 mint (1-3 menit)…");

  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 15000));
    const bal = await l2.getBalance({ address: account.address });
    if (bal > 0n) { console.log("✅ L2 base-sepolia:", formatEther(bal), "ETH"); return; }
    process.stdout.write(".");
  }
  console.log("belum masuk setelah 6 menit — cek manual: sepolia.basescan.org/address/" + account.address);
}
main();
