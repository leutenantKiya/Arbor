"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Film } from "@/lib/films";
import { Logo } from "@/components/logo";
import { WalletInfo } from "@/components/wallet-info";
import { FilmSearch } from "@/components/film-search";
import {
  AnalyticsIcon,
  AudienceIcon,
  ChevronLeftIcon,
  CommentsIcon,
  DashboardIcon,
  EarningsIcon,
  FilmsIcon,
  MenuIcon,
  PlusIcon,
  SettingsIcon,
} from "@/components/studio-icons";

// The Filmmaker Dashboard's app shell: a collapsible sidebar + header, taking
// over the full viewport (fixed inset-0) so it visually replaces the global
// top Nav for this page only — root layout / Nav itself are never touched,
// so every other route keeps the normal top nav untouched.
//
// z-index note: the shell sits at z-[71]/72/73 — just above the global Nav
// (z-[70], components/nav.tsx) so it covers it, but below FilmSearch's own
// portal-rendered search overlay (z-[80]/[90]) so search still opens on top.

const COLLAPSE_KEY = "arbor_studio_sidebar_collapsed";

type NavItem = {
  key: string;
  label: string;
  href: string;
  Icon: (props: { className?: string }) => React.JSX.Element;
  active?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/studio", Icon: DashboardIcon, active: true },
  { key: "films", label: "My Films", href: "#", Icon: FilmsIcon },
  { key: "analytics", label: "Analytics", href: "#", Icon: AnalyticsIcon },
  { key: "earnings", label: "Earnings", href: "#", Icon: EarningsIcon },
  { key: "audience", label: "Audience", href: "#", Icon: AudienceIcon },
  { key: "comments", label: "Comments", href: "#", Icon: CommentsIcon },
  { key: "settings", label: "Settings", href: "#", Icon: SettingsIcon },
];

function initialsOf(name: string): string {
  const parts = name.split(/[\s@.]+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return initials || "F";
}

export function StudioShell({
  displayName,
  walletAddress,
  usdcBalance,
  films,
  children,
}: {
  displayName: string;
  walletAddress: string | null;
  usdcBalance: string | null;
  films: Film[];
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore collapsed state after mount (avoids SSR/client mismatch).
  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {
      /* localStorage unavailable — default expanded */
    }
  }, []);

  // This shell takes over the whole viewport, so lock body scroll while
  // mounted — the shell's own <main> handles scrolling internally.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const initials = initialsOf(displayName);

  return (
    <div className="fixed inset-0 z-[71] flex bg-bark text-cream">
      {/* Mobile drawer scrim */}
      {mobileOpen && (
        <div
          className="animate-backdrop-in fixed inset-0 z-[72] bg-bark/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-[73] flex w-60 flex-col border-r border-line-soft bg-surface transition-transform duration-200 md:sticky md:translate-x-0 md:transition-[width] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-[76px]" : "md:w-60"}`}
      >
        <Link
          href="/"
          className={`flex items-center gap-2.5 px-5 py-6 ${collapsed ? "md:justify-center md:px-0" : ""}`}
        >
          <Logo className="h-6 w-6 shrink-0" />
          <span className={`font-block text-lg font-extrabold tracking-wide ${collapsed ? "md:hidden" : ""}`}>
            Arbor
          </span>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.key}
              href={item.href}
              title={collapsed ? item.label : undefined}
              onClick={(e) => {
                if (!item.active) e.preventDefault();
                setMobileOpen(false);
              }}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                item.active
                  ? "bg-amber/10 text-cream"
                  : "text-ink-dim hover:bg-cream/5 hover:text-cream"
              } ${collapsed ? "md:justify-center" : ""}`}
            >
              {item.active && (
                <span className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-full bg-amber" />
              )}
              <item.Icon
                className={`h-[18px] w-[18px] shrink-0 ${item.active ? "text-amber" : ""}`}
              />
              <span className={`truncate ${collapsed ? "md:hidden" : ""}`}>
                {item.label}
              </span>
              {!item.active && (
                <span
                  className={`ml-auto shrink-0 rounded bg-line-soft px-1.5 py-0.5 font-mono text-[0.58rem] text-ink-faint ${
                    collapsed ? "md:hidden" : ""
                  }`}
                >
                  Soon
                </span>
              )}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 border-t border-line-soft p-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet to-violet-2 font-display text-sm font-bold">
            {initials}
          </div>
          <div className={`min-w-0 ${collapsed ? "md:hidden" : ""}`}>
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="font-mono text-[0.62rem] uppercase tracking-wide text-ink-faint">
              Filmmaker
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden items-center justify-center gap-2 border-t border-line-soft py-3 text-xs text-ink-faint transition-colors hover:bg-cream/5 hover:text-cream md:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeftIcon
            className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-line-soft bg-bark/85 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-sage transition-colors hover:bg-surface hover:text-cream md:hidden"
            aria-label="Open menu"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <div className="min-w-0 max-w-[220px] flex-1 sm:max-w-xs">
            <FilmSearch films={films} />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {walletAddress && (
              <WalletInfo address={walletAddress} usdcBalance={usdcBalance} />
            )}
            <button
              type="button"
              title="Coming soon"
              disabled
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-sm font-medium text-bark opacity-60"
            >
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Upload Film</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
