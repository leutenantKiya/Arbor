"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GiftForm } from "@/components/gift-form";

// Send time / Gift time — trigger button + its modal in one self-contained
// component (same pattern as ApplyCreator), so there's only ever one modal
// instance and it owns its own open/close state directly.
export function GiftTimeModal({
  initialBalanceSeconds,
}: {
  initialBalanceSeconds: number;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeModal = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Body scroll lock + Escape-to-close while open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, closeModal]);

  const hasBalance = initialBalanceSeconds > 0;

  return (
    <>
      <div className="shrink-0">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          disabled={!hasBalance}
          className="inline-flex items-center justify-center rounded-full bg-amber px-5 py-2.5 text-sm font-medium text-bark transition-all hover:bg-amber/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber disabled:cursor-not-allowed disabled:bg-amber/15 disabled:text-amber-soft/50"
        >
          Send time
        </button>
        {!hasBalance && (
          <p className="mt-2 text-xs text-ink-faint">
            Add time to your balance to send a gift.
          </p>
        )}
      </div>

      {/* Portaled to <body>: the trigger button lives inside the page's
          <header className="animate-rise">, and that animation's fill-mode
          leaves a permanent `transform` on it. A `transform` on any ancestor
          becomes the containing block for `position: fixed` descendants, so
          without the portal this overlay would be sized/centered against
          that small header box instead of the real viewport — which is
          exactly why the dialog used to sit pinned near the top with only
          the header area dimmed. Rendering into document.body escapes every
          transformed/filtered ancestor, so `fixed inset-0` is always
          viewport-relative. */}
      {open &&
        createPortal(
          <div
            className="animate-backdrop-in fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-bark/80 p-4 backdrop-blur-md"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeModal();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="gift-time-title"
              className="animate-modal-in relative my-auto w-full max-w-md overflow-hidden rounded-card border border-line bg-surface shadow-2xl"
            >
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="absolute right-4 top-4 z-10 text-sage transition-colors hover:text-cream"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>

              <div className="max-h-[85vh] overflow-y-auto p-6 sm:p-8">
                <p className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-amber">
                  Gift time
                </p>
                <h2
                  id="gift-time-title"
                  className="mt-1 font-display text-2xl font-semibold text-cream"
                >
                  Send time to a friend
                </h2>
                <p className="mt-2 text-sm text-sage">
                  Gift viewing time to another Arbor user by entering their
                  wallet address.
                </p>
                <GiftForm initialBalanceSeconds={initialBalanceSeconds} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
