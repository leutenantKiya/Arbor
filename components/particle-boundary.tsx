"use client";

import dynamic from "next/dynamic";

// AuthCoreContextProvider does real browser-only initialization (window,
// WebSocket, iframe) and crashes during Next's Node-based static
// prerendering ("Init AuthCore failed"). ssr:false keeps it out of the
// server render entirely. This wrapper must be a "use client" file — Next
// disallows dynamic(..., { ssr: false }) directly inside Server Components.
export const ParticleBoundary = dynamic(
  () => import("./particle-provider").then((m) => m.ParticleProvider),
  { ssr: false },
);
