// Server-side Particle verification (ARCHITECTURE.md §8).
//
// The client can claim any {uuid, token} it wants — we never trust that
// claim directly. Calling Particle's own getUserInfo RPC with our project
// server key is the check: it only succeeds if `token` is a currently valid
// session for `uuid`, so a forged or expired pair fails here, before any
// session cookie is issued.
// Docs: https://developers.particle.network/social-logins/api/server/getuserinfo

const PARTICLE_RPC_URL = "https://api.particle.network/server/rpc";

export type ParticleUserInfo = {
  uuid: string;
  email?: string;
  name?: string;
  wallets: { chain_name: string; public_address?: string }[];
};

export async function verifyParticleUser(
  uuid: string,
  token: string,
): Promise<ParticleUserInfo> {
  const projectId = process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID;
  const serverKey = process.env.PARTICLE_SERVER_KEY;
  if (!projectId || !serverKey) {
    throw new Error(
      "Particle project credentials are not set — see .env.example",
    );
  }

  const auth = Buffer.from(`${projectId}:${serverKey}`).toString("base64");
  const res = await fetch(PARTICLE_RPC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "getUserInfo",
      params: [uuid, token],
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error || !data.result) {
    throw new Error(data.error?.message ?? "Particle session could not be verified");
  }
  return data.result as ParticleUserInfo;
}
