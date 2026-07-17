"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useSmartAccount, useSwitchChain } from "@particle-network/connectkit";
import { erc20Abi } from "@/lib/blockchain/abi/erc20";
import { arborVaultAbi } from "@/lib/blockchain/abi/arborVault";
import { type Hex, createWalletClient, custom } from "viem";
import { baseSepolia } from "viem/chains";
import { AAWrapProvider, SendTransactionMode } from "@particle-network/aa";

// ── Contract addresses from env ───────────────────────────────────────

const ARBORVAULT_ADDRESS = (process.env.NEXT_PUBLIC_ARBORVAULT_ADDRESS ??
  "") as `0x${string}`;
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "") as `0x${string}`; // Mock USDC token for this hackathon/project workspace, on Ethereum Sepolia. Official Circle USDC on Ethereum Sepolia is 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238.

// ── USDC 6-decimal helpers ────────────────────────────────────────────

function centsToUsdcAmount(cents: number): bigint {
  return BigInt(cents) * 10000n; // 1 cent = 10_000 on-chain units
}

/**
 * Convert a UUID to bytes32 for on-chain orderId.
 * Strips dashes, left-pads the 16-byte UUID into 32 bytes.
 */
function uuidToBytes32(uuid: string): Hex {
  const stripped = uuid.replace(/-/g, "");
  return ("0x" + stripped.padStart(64, "0")) as Hex;
}

// ── Types ─────────────────────────────────────────────────────────────

type PurchaseStep = "idle" | "switching-chain" | "approving" | "depositing" | "confirming" | "done" | "error";

type PurchaseButtonProps = {
  packageId: string;
  price: string;
  cents: number;
  seconds: number;
  disabled?: boolean;
};

export function PurchaseButton({
  packageId,
  price,
  cents,
  seconds,
  disabled = false,
}: PurchaseButtonProps) {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const smartAccount = useSmartAccount();
  const { switchChainAsync } = useSwitchChain();

  const [step, setStep] = useState<PurchaseStep>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase() {
    if (!isConnected || !address || !smartAccount || !publicClient) {
      setError("Please sign in first");
      return;
    }

    setStep("idle");
    setError(null);

    try {
      // Guard the chain: if the connected chain !== 11155111, switch to Ethereum Sepolia
      const currentChainId = Number(chainId);
      if (currentChainId !== baseSepolia.id) {
        try {
          setStep("switching-chain");
          await switchChainAsync({ chainId: baseSepolia.id });
        } catch (switchError) {
          console.error("Failed to switch chain:", switchError);
          setError("Failed to switch network. Please switch to Ethereum Sepolia in your wallet.");
          setStep("idle");
          return;
        }
      }

      const amount = centsToUsdcAmount(cents);
      const smartAccountAddress = (await smartAccount.getAddress()) as `0x${string}`;

      // Wrap the smart account inside the AAWrapProvider configured for gasless mode
      const provider = new AAWrapProvider(smartAccount, SendTransactionMode.Gasless);
      const walletClient = createWalletClient({
        account: smartAccountAddress,
        chain: baseSepolia,
        transport: custom(provider),
      });

      // ── Step 1: Generate a purchase order ID ────────────────────────
      // We use crypto.randomUUID() as the orderId, which will be stored
      // on-chain as bytes32 and linked to the database purchase row.
      const orderId = crypto.randomUUID();
      const orderIdBytes32 = uuidToBytes32(orderId);

      // ── Step 2: Check existing allowance ────────────────────────────
      const currentAllowance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "allowance",
        args: [smartAccountAddress, ARBORVAULT_ADDRESS],
      });

      // ── Step 3: Approve USDC if needed ──────────────────────────────
      if ((currentAllowance as bigint) < amount) {
        setStep("approving");

        const approveHash = await walletClient.writeContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [ARBORVAULT_ADDRESS, amount],
          chain: baseSepolia,
          account: smartAccountAddress,
        });

        await publicClient.waitForTransactionReceipt({
          hash: approveHash,
          confirmations: 1,
        });
      }

      // ── Step 4: Deposit to ArborVault ───────────────────────────────
      setStep("depositing");

      const depositHash = await walletClient.writeContract({
        address: ARBORVAULT_ADDRESS,
        abi: arborVaultAbi,
        functionName: "deposit",
        args: [amount, orderIdBytes32],
        chain: baseSepolia,
        account: smartAccountAddress,
      });

      await publicClient.waitForTransactionReceipt({
        hash: depositHash,
        confirmations: 1,
      });

      // ── Step 5: Confirm with backend ────────────────────────────────
      setStep("confirming");

      const res = await fetch("/api/purchase/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: depositHash, packageId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error || `Confirmation failed (${res.status})`,
        );
      }

      // ── Done! ───────────────────────────────────────────────────────
      setStep("done");

      // Refresh the page to show updated balance
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("[PurchaseButton] purchase failed:", err);
      setStep("error");

      const message = (err as Error).message || "Purchase failed";
      // Clean up common viem/wallet error messages
      if (message.includes("User rejected") || message.includes("denied")) {
        setError("Transaction cancelled");
      } else if (message.includes("insufficient")) {
        setError("Insufficient USDC balance");
      } else {
        setError(message.length > 80 ? message.slice(0, 80) + "…" : message);
      }
    }
  }

  // ── Button label by step ────────────────────────────────────────────
  const labels: Record<PurchaseStep, string> = {
    idle: `Buy — ${price}`,
    "switching-chain": "Switching Network…",
    approving: "Approving USDC…",
    depositing: "Depositing…",
    confirming: "Confirming…",
    done: "✓ Time added!",
    error: `Buy — ${price}`,
  };

  const isBusy = step === "switching-chain" || step === "approving" || step === "depositing" || step === "confirming";
  const isDone = step === "done";

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={handlePurchase}
        disabled={disabled || isBusy || isDone || !isConnected}
        className={`w-full rounded-full py-2.5 text-sm font-medium transition-all ${
          isDone
            ? "bg-fern/20 text-fern"
            : isBusy
              ? "cursor-wait bg-amber/20 text-amber-soft"
              : "bg-amber text-bark hover:bg-amber/90 disabled:cursor-not-allowed disabled:bg-amber/10 disabled:text-amber-soft/50"
        }`}
      >
        {labels[step]}
      </button>
      {error && (
        <p className="mt-2 text-center text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
