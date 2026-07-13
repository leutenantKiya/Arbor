// Particle Network configuration — day-1 spike scaffold.
//
// Findings from the docs spike (2026-07-13):
// - Social login + embedded wallet: @particle-network/authkit
//   (useEthereum() → { address, provider }); supports Arbitrum Sepolia (421614).
// - Universal Accounts: @particle-network/universal-account-sdk —
//   MAINNET ONLY (Ethereum, BNB, X Layer, Base, Arbitrum, Solana).
//   A testnet demo therefore uses Particle Auth + AA/paymaster, with UA as
//   the mainnet path. Chain decision tracked in the day-1 report.
//
// Real keys come from dashboard.particle.network → .env (see .env.example).

export const particleConfig = {
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID ?? "",
  clientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY ?? "",
  appId: process.env.NEXT_PUBLIC_PARTICLE_APP_ID ?? "",
};

export const particleConfigured = Boolean(
  particleConfig.projectId && particleConfig.clientKey && particleConfig.appId,
);

export const ARBITRUM_SEPOLIA_ID = 421614;
