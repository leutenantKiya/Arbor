import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Stateless session cookie (ARCHITECTURE.md §8): the hottest API path
// (heartbeat) must verify identity with zero extra DB reads. A 24h expiry
// is short enough that revocation is unnecessary for the hackathon.
//
// One cookie, one payload shape for every sign-in method
// (docs/AUTH-ARCHITECTURE.md): userId is always present — the rest of the
// app keys on it alone. Identity extras are optional and method-specific:
// Particle sessions carry particleUuid/walletAddress, password sessions
// carry email/name.
export const SESSION_COOKIE = "arbor_session";
const MAX_AGE_SECONDS = 60 * 60 * 24;

export type SessionPayload = {
  userId: string;
  particleUuid?: string;
  walletAddress?: string;
  email?: string;
  name?: string;
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

// Cookie-level helpers for server components and server actions.

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export const SESSION_MAX_AGE_SECONDS = MAX_AGE_SECONDS;
