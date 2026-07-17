"use client";

import React from "react";
import { ConnectKitProvider, createConfig } from "@particle-network/connectkit";
import { authWalletConnectors } from "@particle-network/connectkit/auth";
import {
  evmWalletConnectors,
  coinbaseWallet,
  injected,
} from "@particle-network/connectkit/evm";
import { arbitrum, sepolia } from "@particle-network/connectkit/chains";
import { wallet, type EntryPosition } from "@particle-network/connectkit/wallet";
import { aa } from "@particle-network/connectkit/aa";
import { particleConfig } from "@/lib/particle/config";

const config = createConfig({
  projectId: particleConfig.projectId,
  clientKey: particleConfig.clientKey,
  appId: particleConfig.appId,

  appearance: {
    // Visible but phased: wallet sign-in completes when SIWE ships (day 5).
    // Until then auth-button.tsx catches wallet connections and gracefully
    // disconnects with a "coming soon" notice — no dead ends.
    recommendedWallets: [
      { walletId: "metaMask", label: "Coming soon" },
      { walletId: "coinbaseWallet", label: "Coming soon" },
    ],
    // Social first — the "invisible blockchain" onboarding (PLANNING.md §9).
    connectorsOrder: ["social", "email", "wallet"],
    language: "en-US",
    theme: {
      "--pcm-accent-color": "#e8a33d",
      "--pcm-rounded-md": "8px",
      "--pcm-rounded-lg": "11px",
    },
  },

  walletConnectors: [
    // Social login → embedded wallet. PromptSettingType.none (0) keeps
    // onboarding free of "set a wallet password" steps.
    authWalletConnectors({
      authTypes: ["google", "apple", "email"],
      fiatCoin: "USD",
      promptSettingConfig: {
        promptMasterPasswordSettingWhenLogin: 0,
        promptPaymentPasswordSettingWhenSign: 0,
      },
    }),
    // External-wallet path — visible, completes once SIWE lands.
    evmWalletConnectors({
      metadata: { name: "Arbor" },
      connectorFns: [injected({ target: "metaMask" }), coinbaseWallet()],
      multiInjectedProviderDiscovery: true,
    }),
  ],

  plugins: [
    // Gasless Account Abstraction — Biconomy V2 smart account. The account
    // is counterfactual: it deploys inside the first purchase's UserOp
    // (docs/AUTH-ARCHITECTURE.md, "lazy account creation").
    aa({ name: "BICONOMY", version: "2.0.0" }),
    wallet({
      entryPosition: "bottom-right" as EntryPosition,
      visible: false, // no floating wallet widget — invisible by default
    }),
  ],

  // Ethereum Sepolia first (demo); mainnet Arbitrum = production + UA capability.
  // Moved off Arbitrum Sepolia — "Chain disabled: 421614" traced to a
  // per-project chain gate on Particle's backend (not a code/SDK issue,
  // confirmed via scratch/test-particle-aa.ts). Ethereum Sepolia isn't gated.
  chains: [sepolia, arbitrum],
});

export function ParticleProvider({ children }: { children: React.ReactNode }) {
  return <ConnectKitProvider config={config}>{children}</ConnectKitProvider>;
}