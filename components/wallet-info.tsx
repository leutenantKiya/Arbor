"use client";

import { useState } from "react";
import { shortenAddress } from "@/lib/blockchain/utils";

type WalletInfoProps = {
  address: string;
  usdcBalance: string | null;
};

export function WalletInfo({ address, usdcBalance }: WalletInfoProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  return (
    <div className="hidden items-center gap-2 rounded-full border border-line/60 bg-surface px-3 py-1.5 text-xs text-sage sm:flex">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-sage-light">{shortenAddress(address)}</span>
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy address"}
          className="text-sage/60 hover:text-cream transition-colors p-0.5 rounded hover:bg-white/5 active:scale-95 flex items-center justify-center"
        >
          {copied ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-fern"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
      {usdcBalance !== null && (
        <>
          <span className="h-3 w-px bg-line/60" />
          <span className="font-semibold text-amber-soft">{usdcBalance} USDC</span>
        </>
      )}
    </div>
  );
}
