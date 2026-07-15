"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { subscribeBalance } from "@/lib/balance-bus";

function formatBalance(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Nav balance pill. Server renders the initial ledger value (no loading
// flash); after that it follows live signals from the player: resyncs to
// each heartbeat ack and ticks down 1s/s cosmetically while playing.
export function BalancePill({ initialSeconds }: { initialSeconds: number | null }) {
  const [seconds, setSeconds] = useState<number | null>(initialSeconds);
  const [playing, setPlaying] = useState(false);

  useEffect(
    () =>
      subscribeBalance(({ remainingSeconds, playing: isPlaying }) => {
        setSeconds(remainingSeconds);
        setPlaying(isPlaying);
      }),
    [],
  );

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () => setSeconds((s) => (s === null ? s : Math.max(0, s - 1))),
      1_000,
    );
    return () => clearInterval(id);
  }, [playing]);

  return (
    <Link
      href="/time"
      aria-label="Viewing time remaining"
      className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-amber-soft transition-colors hover:border-amber/40"
    >
      <span className="tabular-nums">
        {seconds !== null ? formatBalance(seconds) : "-"}
      </span>
    </Link>
  );
}
