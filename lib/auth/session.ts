import { SignJWT, jwtVerify } from "jose";

// Stateless session cookie (ARCHITECTURE.md §8): the hottest API path
// (heartbeat) must verify identity with zero extra DB reads. A 24h expiry
// is short enough that revocation is unnecessary for the hackathon.
export const SESSION_COOKIE = "arbor_session";
const MAX_AGE_SECONDS = 60 * 60 * 24;

export type SessionPayload = {
  userId: string;
  particleUuid: string;
  walletAddress: string;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set — see .env.example");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE_SECONDS = MAX_AGE_SECONDS;
