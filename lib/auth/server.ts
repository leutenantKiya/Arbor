// Re-export session utilities as the canonical server-side auth interface.
// Replaced @neondatabase/neon-js createNeonAuth (which requires an external
// NEON_AUTH_BASE_URL) with self-contained JWT sessions via jose.
export { getSession, createSession, deleteSession } from './session';
export type { SessionPayload } from './session';