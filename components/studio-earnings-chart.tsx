"use client";

import { useState } from "react";
import type { DailyEarning } from "@/lib/db/queries";
import { formatCents } from "@/lib/format";

// Real per-day filmmaker-share totals (lib/db/queries.ts getDailyEarnings),
// rendered as a plain SVG bar chart. Mock UI's reference chart draws a random
// walk (Math.random()) — this draws whatever the ledger actually recorded, so
// an all-zero range renders as flat bars rather than a fabricated curve.
const RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
] as const;

type RangeDays = (typeof RANGES)[number]["days"];

export function StudioEarningsChart({
  data,
}: {
  data: Record<RangeDays, DailyEarning[]>;
}) {
  const [active, setActive] = useState<RangeDays>(30);
  const series = data[active] ?? [];

  const total = series.reduce((a, b) => a + b.cents, 0);
  const max = Math.max(1, ...series.map((d) => d.cents));

  const W = 600;
  const H = 140;
  const barGap = 3;
  const barW = series.length > 0 ? W / series.length - barGap : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm uppercase tracking-widest text-sage">
          Earnings
        </p>
        <div className="flex gap-1 rounded-lg border border-line-soft bg-bark/40 p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setActive(r.days)}
              className={`rounded-md px-2.5 py-1 font-mono text-[0.68rem] transition-colors ${
                active === r.days
                  ? "bg-amber/15 text-amber"
                  : "text-ink-faint hover:text-sage"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 font-display text-2xl font-semibold tabular-nums">
        {formatCents(total)}
      </p>
      <p className="text-xs text-ink-faint">
        Last {active} days
        {series.length > 0 ? ` · ${series.filter((d) => d.cents > 0).length} active days` : ""}
      </p>

      <div className="mt-4">
        {series.length === 0 ? (
          <p className="py-8 text-center text-sm text-sage">
            No earnings recorded in this window yet.
          </p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" aria-hidden="true">
            {series.map((d, i) => {
              const h = Math.max(2, (d.cents / max) * (H - 4));
              const x = i * (barW + barGap);
              return (
                <rect
                  key={d.date}
                  x={x}
                  y={H - h}
                  width={Math.max(1, barW)}
                  height={h}
                  rx={Math.min(2, barW / 2)}
                  className="fill-amber"
                  opacity={d.cents > 0 ? 1 : 0.18}
                />
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
