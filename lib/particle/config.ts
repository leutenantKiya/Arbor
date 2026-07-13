// Particle Network credentials — read from env, never hardcoded.
// Server-side verification (lib/particle/server.ts) reads projectId from
// process.env directly; this is the client-side view.

export const particleConfig = {
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID ?? "",
  clientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY ?? "",
  appId: process.env.NEXT_PUBLIC_PARTICLE_APP_ID ?? "",
};

export const particleConfigured = Boolean(
  particleConfig.projectId && particleConfig.clientKey && particleConfig.appId,
);

export const ARBITRUM_SEPOLIA_ID = 421614;