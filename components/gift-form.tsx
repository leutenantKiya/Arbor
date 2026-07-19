"use client";

import { useState } from "react";
import { formatSeconds } from "@/lib/format";

type GiftFormProps = {
  initialBalanceSeconds: number;
};

export function GiftForm({ initialBalanceSeconds }: GiftFormProps) {
  const [recipientWallet, setRecipientWallet] = useState("");
  const [seconds, setSeconds] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const maxSeconds = initialBalanceSeconds;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const secondsNum = parseInt(seconds, 10);
    if (!recipientWallet.trim()) {
      setError("Enter a wallet address");
      setStatus("error");
      return;
    }
    if (!secondsNum || secondsNum <= 0) {
      setError("Enter a valid amount");
      setStatus("error");
      return;
    }
    if (secondsNum > maxSeconds) {
      setError("Not enough balance");
      setStatus("error");
      return;
    }

    try {
      const res = await fetch("/api/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientWalletAddress: recipientWallet.trim(),
          seconds: secondsNum,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Gift failed (${res.status})`);
      }

      setStatus("success");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setStatus("error");
      setError((err as Error).message || "Gift failed");
    }
  }

  if (maxSeconds <= 0) return null;

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label className="block font-mono text-xs uppercase tracking-widest text-sage">
          Recipient wallet address
        </label>
        <input
          type="text"
          value={recipientWallet}
          onChange={(e) => setRecipientWallet(e.target.value)}
          placeholder="0x..."
          className="mt-1.5 w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-cream placeholder:text-ink-faint focus:border-amber/50 focus:outline-none"
          disabled={status === "loading" || status === "success"}
        />
      </div>
      <div>
        <label className="block font-mono text-xs uppercase tracking-widest text-sage">
          Amount to gift (seconds)
        </label>
        <input
          type="number"
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
          max={maxSeconds}
          min={1}
          placeholder={`Max ${maxSeconds}s`}
          className="mt-1.5 w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-cream placeholder:text-ink-faint focus:border-amber/50 focus:outline-none"
          disabled={status === "loading" || status === "success"}
        />
        <p className="mt-1 text-xs text-ink-faint">
          Available: {formatSeconds(maxSeconds)}
        </p>
      </div>
      <button
        type="submit"
        disabled={status === "loading" || status === "success"}
        className="w-full rounded-full bg-amber py-2.5 text-sm font-medium text-bark transition-opacity hover:bg-amber/90 disabled:cursor-not-allowed disabled:bg-amber/30 disabled:text-bark/60"
      >
        {status === "loading" ? "Sending..." : status === "success" ? "✓ Gift sent!" : "Send gift"}
      </button>
      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </form>
  );
}
