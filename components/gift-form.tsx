"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatSeconds } from "@/lib/format";

type GiftFormProps = {
  initialBalanceSeconds: number;
};

type Unit = "seconds" | "minutes" | "hours";

const UNIT_IN_SECONDS: Record<Unit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
};

const UNIT_SUFFIX: Record<Unit, string> = {
  seconds: "sec",
  minutes: "min",
  hours: "hr",
};

// Trims float noise (e.g. 1.5000000000000002) without forcing trailing
// zeros on whole numbers, so the field reads "90" not "90.00".
function trimAmount(n: number): string {
  return Number(n.toFixed(2)).toString();
}

export function GiftForm({ initialBalanceSeconds }: GiftFormProps) {
  const [recipientWallet, setRecipientWallet] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<Unit>("seconds");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const maxSeconds = initialBalanceSeconds;
  const maxInUnit = maxSeconds / UNIT_IN_SECONDS[unit];

  // Recipient input detection
  const cleanRecipient = recipientWallet.trim();
  const isWallet = cleanRecipient.startsWith("0x") && cleanRecipient.length === 42;

  // Switching units converts the typed amount so the underlying seconds
  // value is preserved — e.g. "90" in seconds becomes "1.5" in minutes,
  // instead of clearing the field and making the user redo the math.
  function handleUnitChange(nextUnit: Unit) {
    const typed = parseFloat(amount);
    if (!isNaN(typed)) {
      const totalSeconds = typed * UNIT_IN_SECONDS[unit];
      setAmount(trimAmount(totalSeconds / UNIT_IN_SECONDS[nextUnit]));
    }
    setUnit(nextUnit);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const recipient = recipientWallet.trim();
    const amountNum = parseFloat(amount);
    const secondsNum = Math.round(amountNum * UNIT_IN_SECONDS[unit]);

    if (!recipient) {
      setError("Enter a recipient");
      setStatus("error");
      return;
    }
    if (!amountNum || secondsNum <= 0) {
      setError("Enter a valid amount");
      setStatus("error");
      return;
    }
    if (secondsNum > maxSeconds) {
      setError("Not enough balance");
      setStatus("error");
      return;
    }

    const isRecipientWallet = recipient.startsWith("0x") && recipient.length === 42;
    const requestBody = isRecipientWallet
      ? { recipientWalletAddress: recipient, seconds: secondsNum }
      : { socialId: recipient.replace(/^@/, "").toLowerCase(), seconds: secondsNum };

    try {
      const res = await fetch("/api/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || `Gift failed (${res.status})`);
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
        <label className="block font-mono text-[10px] uppercase tracking-widest text-sage mb-0.5">
          Recipient
        </label>
        <span className="block text-[11px] text-sage/50 mb-1.5">
          Send using wallet address or Arbor ID
        </span>
        <div className="relative mt-1.5 ml-4">
          {/* Recipient Type Indicator - Overlapping Pill Style */}
          <div className="absolute left-[-16px] top-1/2 -translate-y-1/2 z-10 flex items-center justify-center pointer-events-none select-none">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber text-bark shadow border border-bark/10">
              <AnimatePresence mode="wait">
                {isWallet ? (
                  <motion.div
                    key="wallet-icon"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center justify-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4.5 w-4.5"
                    >
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M16 11h.01" />
                      <path d="M22 10h-6a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h6" />
                    </svg>
                  </motion.div>
                ) : (
                  <motion.div
                    key="social-icon"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center justify-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4.5 w-4.5"
                    >
                      <circle cx="12" cy="12" r="4" />
                      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
                    </svg>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <input
            type="text"
            value={recipientWallet}
            onChange={(e) => setRecipientWallet(e.target.value)}
            placeholder="0x... or @username"
            className="w-full rounded-lg border border-line bg-surface py-2.5 pr-4 pl-8 text-sm text-cream placeholder:text-sage/20 focus:border-amber/55 focus:outline-none"
            disabled={status === "loading" || status === "success"}
          />
        </div>
      </div>
      <div>
        <label className="block font-mono text-xs uppercase tracking-widest text-sage">
          Amount to gift
        </label>
        <div className="mt-1.5 flex items-stretch gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            max={maxInUnit}
            min={0}
            step="any"
            placeholder={`Max ${trimAmount(maxInUnit)}`}
            className="w-full min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-cream placeholder:text-ink-faint focus:border-amber/50 focus:outline-none"
            disabled={status === "loading" || status === "success"}
          />
          <div className="flex shrink-0 gap-0.5 rounded-lg border border-line bg-surface p-0.5">
            {(Object.keys(UNIT_IN_SECONDS) as Unit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => handleUnitChange(u)}
                disabled={status === "loading" || status === "success"}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                  unit === u
                    ? "bg-amber text-bark"
                    : "text-ink-faint hover:text-cream"
                }`}
              >
                {UNIT_SUFFIX[u]}
              </button>
            ))}
          </div>
        </div>
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
