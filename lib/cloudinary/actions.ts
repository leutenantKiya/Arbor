'use server';

// Cloudinary signed-upload credentials — upload logic only, no DB writes here
// (see lib/films/actions.ts for the insert). The client POSTs the video
// bytes directly to Cloudinary using the signature this mints; they never
// pass through our server, which avoids Next.js's Server Action body-size
// limit for large video files and keeps CLOUDINARY_API_SECRET server-only.

import { createHash } from 'node:crypto';
import { getSession } from '@/lib/auth/server';
import { isUserFilmmaker } from '@/lib/db/queries';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
const API_KEY = process.env.CLOUDINARY_API_KEY ?? '';
const API_SECRET = process.env.CLOUDINARY_API_SECRET ?? '';
const UPLOAD_FOLDER = 'arbor/films';

export type UploadSignature = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
};

export type UploadSignatureResult =
  | { ok: true; data: UploadSignature }
  | { ok: false; error: string };

/**
 * Mints a signed-upload credential for the currently authenticated filmmaker.
 * Reuses the existing session — never a new auth path.
 */
export async function getUploadSignature(): Promise<UploadSignatureResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Please sign in to upload a film.' };
  }

  const isFilmmaker = await isUserFilmmaker(session.userId);
  if (!isFilmmaker) {
    return { ok: false, error: 'Only verified filmmakers can upload films.' };
  }

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return { ok: false, error: 'Uploads are not configured yet.' };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = {
    folder: UPLOAD_FOLDER,
    timestamp,
  };

  // Cloudinary's signature spec: alphabetically-sorted "key=value" pairs of
  // every signed param, joined with "&", with the API secret appended, SHA-1
  // hashed to hex. resource_type/api_key/file are never part of this string.
  const toSign = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join('&');

  const signature = createHash('sha1')
    .update(toSign + API_SECRET)
    .digest('hex');

  return {
    ok: true,
    data: {
      signature,
      timestamp,
      apiKey: API_KEY,
      cloudName: CLOUD_NAME,
      folder: UPLOAD_FOLDER,
    },
  };
}
