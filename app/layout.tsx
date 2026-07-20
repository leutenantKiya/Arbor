import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import { Nav } from "@/components/nav";
import { ParticleBoundary } from "@/components/particle-boundary";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Mono for labels, tickers, wallet addresses (Mock UI --f-mono)
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibmplex",
});

export const metadata: Metadata = {
  title: "Arbor — Pay for what you watch",
  description:
    "Premium streaming for independent cinema. Buy viewing time, not subscriptions — the meter only runs while the film plays.",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${ibmPlexMono.variable}`}
    >
      <body>
        <ParticleBoundary>
          <Nav />
          <main className="pt-16">{children}</main>
        </ParticleBoundary>
      </body>
    </html>
  );
}
