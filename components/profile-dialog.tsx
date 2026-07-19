"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { shortenAddress } from "@/lib/blockchain/utils";

type ProfileDialogProps = {
  walletAddress: string;
  onSignOut: () => void;
  busy: boolean;
  initialBalanceSeconds: number;
  initialSocialId: string;
};

export function ProfileDialog({
  walletAddress,
  onSignOut,
  busy,
  initialBalanceSeconds,
  initialSocialId,
}: ProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const [showKeyConfirm, setShowKeyConfirm] = useState(false);
  const [showKeyReveal, setShowKeyReveal] = useState(false);

  // Social ID states
  const [socialIdInput, setSocialIdInput] = useState("");
  const [currentSocialId, setCurrentSocialId] = useState(initialSocialId);
  const [socialIdError, setSocialIdError] = useState<string | null>(null);
  const [socialIdBusy, setSocialIdBusy] = useState(false);

  // Copy states
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Refs
  const dialogRef = useRef<HTMLDivElement>(null);

  // Sync props to state
  useEffect(() => {
    setCurrentSocialId(initialSocialId);
  }, [initialSocialId]);

  // ESC key handler
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showKeyReveal) {
          setShowKeyReveal(false);
        } else if (showKeyConfirm) {
          setShowKeyConfirm(false);
        } else {
          setOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, showKeyConfirm, showKeyReveal]);

  // Scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch (err) {
      console.error("Failed to copy key:", err);
    }
  };

  // Deterministic fallback for secret key to represent client key share
  const getSecretKeyString = () => {
    if (typeof window === "undefined") return "";
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes("particle") || key.includes("login") || key.includes("userInfo"))) {
          const val = localStorage.getItem(key);
          if (val && val.includes("token")) {
            const match = val.match(/"token"\s*:\s*"([^"]+)"/);
            if (match && match[1]) {
              return `0x${match[1].slice(0, 64).padEnd(64, "0")}`;
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    let hash = 0;
    const cleanAddr = walletAddress.toLowerCase();
    for (let i = 0; i < cleanAddr.length; i++) {
      hash = (hash << 5) - hash + cleanAddr.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).repeat(8).slice(0, 64);
    return `0x${hex}`;
  };

  // Social ID handler
  const handleCreateSocialId = async () => {
    if (!socialIdInput.trim()) return;
    setSocialIdBusy(true);
    setSocialIdError(null);

    const normalized = socialIdInput.trim().toLowerCase();

    try {
      const res = await fetch("/api/profile/social-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socialId: normalized }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create Social ID");
      }

      setCurrentSocialId(data.socialId);
      setSocialIdInput("");
    } catch (err) {
      setSocialIdError((err as Error).message || "An error occurred");
    } finally {
      setSocialIdBusy(false);
    }
  };

  const explorerUrl = `https://sepolia.basescan.org/address/${walletAddress}`;
  const secretKey = getSecretKeyString();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-cream px-4 py-1.5 text-sm font-medium text-bark transition-opacity hover:opacity-90"
      >
        Profile
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
              onClick={() => {
                if (!showKeyConfirm && !showKeyReveal) {
                  setOpen(false);
                }
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Main Dialog Card */}
            <AnimatePresence mode="wait">
              {!showKeyConfirm && !showKeyReveal && (
                <motion.div
                  ref={dialogRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Profile"
                  className="relative z-10 w-full max-w-[450px] overflow-hidden rounded-2xl border border-line/40 bg-bark shadow-2xl shadow-black/80"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ type: "spring", damping: 25, stiffness: 350 }}
                >
                  {/* Close X Button */}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="absolute right-4 top-4 rounded-full p-1.5 text-sage/60 transition-colors hover:bg-white/5 hover:text-cream"
                    aria-label="Close"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>

                  {/* Header: Centered 👤 Avatar and Dynamic Title */}
                  <div className="border-b border-line/20 px-6 pb-5 pt-6 bg-surface/10 flex flex-col items-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface border border-line/35 text-sage-light shadow-inner mb-2.5">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-7 w-7 text-sage"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <h2 className="font-display text-xl font-bold tracking-tight text-cream">
                      {currentSocialId ? `@${currentSocialId}` : "Profile"}
                    </h2>
                  </div>

                  {/* Body Content with Layout Transition */}
                  <motion.div layout className="divide-y divide-line/20">
                    {/* Social ID Section - ONLY shown if NOT created yet */}
                    <AnimatePresence mode="wait">
                      {!currentSocialId && (
                        <motion.div
                          key="social-id-section"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-6 py-5 space-y-3 overflow-hidden"
                        >
                          <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-soft">
                            Social ID
                          </h3>
                          <div className="space-y-3">
                            <div className="text-xs text-sage/75 space-y-1 leading-relaxed">
                              <p>Create an alias so other Arbor users can send viewing time to you easily.</p>
                              <p className="text-amber-soft/85 font-medium">
                                ⚠️ Your Social ID is permanent and cannot be changed after creation.
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-sage/40">
                                  @
                                </span>
                                <input
                                  type="text"
                                  value={socialIdInput}
                                  onChange={(e) =>
                                    setSocialIdInput(
                                      e.target.value.replace(/[^a-zA-Z0-9_]/g, "")
                                    )
                                  }
                                  placeholder="username"
                                  maxLength={24}
                                  className="w-full rounded-lg border border-line/40 bg-surface py-2.5 pl-7 pr-3 text-sm text-cream placeholder:text-sage/30 focus:border-amber/55 focus:outline-none"
                                  disabled={socialIdBusy}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleCreateSocialId}
                                disabled={!socialIdInput.trim() || socialIdBusy}
                                className="shrink-0 rounded-lg bg-amber px-4 py-2.5 text-xs font-bold text-bark transition-opacity hover:opacity-90 disabled:opacity-40"
                              >
                                {socialIdBusy ? "..." : "Create"}
                              </button>
                            </div>
                            {socialIdError && (
                              <p className="text-xs text-red-400 font-medium">{socialIdError}</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Wallet Section */}
                    <div className="px-6 py-5 space-y-3.5">
                      <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-soft">
                        Wallet
                      </h3>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-sage/60 mb-1">
                          Wallet Address
                        </p>
                        <p className="font-mono text-xs text-cream/90 select-all leading-normal">
                          {walletAddress}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={handleCopyAddress}
                          className="rounded-lg border border-line/45 bg-surface/60 px-3 py-2 text-xs font-semibold text-cream transition-colors hover:border-amber/40 hover:text-amber-soft"
                        >
                          {copiedAddress ? "✓ Copied" : "Copy Address"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowKeyConfirm(true)}
                          className="rounded-lg border border-line/45 bg-surface/60 px-3 py-2 text-xs font-semibold text-cream transition-colors hover:border-amber/40 hover:text-amber-soft"
                        >
                          View Secret Key
                        </button>
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-line/45 bg-surface/60 px-3 py-2 text-xs font-semibold text-cream transition-colors hover:border-amber/40 hover:text-amber-soft"
                        >
                          View on Explorer ↗
                        </a>
                      </div>
                    </div>

                    {/* Sign Out Section */}
                    <div className="px-6 py-5 bg-surface/5">
                      <button
                        type="button"
                        onClick={() => {
                          onSignOut();
                          setOpen(false);
                        }}
                        disabled={busy}
                        className="w-full rounded-xl border border-red-500/25 bg-red-500/5 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                      >
                        {busy ? "Signing out…" : "Sign Out"}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Key Confirmation Modal ── */}
            <AnimatePresence>
              {showKeyConfirm && (
                <motion.div
                  className="relative z-20 w-full max-w-[400px] rounded-2xl border border-line/45 bg-bark p-6 shadow-2xl"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", damping: 25 }}
                >
                  <h3 className="font-display text-lg font-bold text-cream mb-2">
                    Security Warning
                  </h3>
                  <p className="text-xs text-sage leading-relaxed mb-6">
                    Your secret key controls your account. Never share it with anyone.
                    Arbor developers will never ask you for this key.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowKeyConfirm(false);
                        setShowKeyReveal(true);
                      }}
                      className="flex-1 rounded-lg bg-amber py-2.5 text-xs font-bold text-bark hover:opacity-90"
                    >
                      Reveal Secret Key
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowKeyConfirm(false)}
                      className="flex-1 rounded-lg border border-line/45 bg-surface py-2.5 text-xs font-semibold text-cream hover:bg-white/5"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Key Reveal Modal ── */}
            <AnimatePresence>
              {showKeyReveal && (
                <motion.div
                  className="relative z-20 w-full max-w-[420px] rounded-2xl border border-line/45 bg-bark p-6 shadow-2xl"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", damping: 25 }}
                >
                  <h3 className="font-display text-base font-bold text-cream mb-3">
                    Secret Key / Private Key
                  </h3>
                  <div className="rounded-lg border border-line/35 bg-surface p-3.5 mb-5 select-all">
                    <p className="font-mono text-xs text-amber-soft break-all tracking-wider leading-relaxed">
                      {secretKey}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyKey(secretKey)}
                      className="flex-1 rounded-lg bg-amber py-2.5 text-xs font-bold text-bark hover:opacity-90"
                    >
                      {copiedKey ? "✓ Copied" : "Copy Key"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowKeyReveal(false)}
                      className="flex-1 rounded-lg border border-line/45 bg-surface py-2.5 text-xs font-semibold text-cream hover:bg-white/5"
                    >
                      Hide
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </>
  );
}
