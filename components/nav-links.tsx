"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Browse" },
  { href: "/time", label: "Time" },
  { href: "/studio", label: "Studio" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-7 font-mono text-[0.78rem] tracking-wide text-sage md:flex">
      {LINKS.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`relative py-1 transition-colors hover:text-cream ${
              active ? "text-amber" : ""
            }`}
          >
            {link.label}
            {active && (
              <span className="absolute inset-x-0 -bottom-0.5 h-px bg-amber" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
