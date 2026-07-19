'use server';

import { db } from '@/lib/db/client';
import { applications } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { hasExistingApplication } from '@/lib/db/queries';

// Shape the client sends to the Server Action. Booleans are semantic here; the
// action maps them to the "yes"/"no" varchar values the applications table
// actually stores. DB-managed columns (id, user_id, created_at, updated_at) are
// never accepted from the client — the note forbids it and user_id comes from
// the session instead.
export type CreatorApplicationInput = {
  // required
  fullName: string;
  email: string;
  country: string;
  hasReleasedWorkBefore: boolean;
  experience: string;
  holdsFullRights: boolean;
  applicantType: string;
  paymentWalletAddress: string;
  // optional
  portfolioLinks?: string;
  previousFilmsLink?: string;
  previousAwardsLink?: string;
  shortBio?: string;
  consideredGenre?: string;
  coOwnerFullName?: string;
  closingStatement?: string;
};

export type CreatorApplicationResult =
  | { ok: true }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

// Mirrors the DB CHECK constraints on the applications table — reject bad
// values with a friendly message instead of a raw constraint violation.
const APPLICANT_TYPES = ['individual', 'production_company'] as const;
const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'professional'] as const;

const yesNo = (b: boolean) => (b ? 'yes' : 'no');

// Trim + clamp a required varchar to its column length.
function clamp(value: string, max: number): string {
  return value.trim().slice(0, max);
}

// Trim an optional field down to null (clamped) so empty strings never insert.
function optional(value: string | undefined, max?: number): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return max ? trimmed.slice(0, max) : trimmed;
}

export async function submitCreatorApplication(
  input: CreatorApplicationInput,
): Promise<CreatorApplicationResult> {
  // ── Validate every required field before touching the DB ──
  const fullName = clamp(input.fullName ?? '', 400);
  const email = clamp((input.email ?? '').toLowerCase(), 200);
  const country = clamp(input.country ?? '', 60);
  const experience = clamp(input.experience ?? '', 20);
  const applicantType = clamp(input.applicantType ?? '', 30);
  const paymentWalletAddress = (input.paymentWalletAddress ?? '').trim();

  if (!fullName || !country || !experience || !applicantType) {
    return { ok: false, error: 'Please complete all required fields.' };
  }
  if (!(APPLICANT_TYPES as readonly string[]).includes(applicantType)) {
    return { ok: false, error: 'Select a valid applicant type.' };
  }
  if (!(EXPERIENCE_LEVELS as readonly string[]).includes(experience)) {
    return { ok: false, error: 'Select a valid experience level.' };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (
    typeof input.hasReleasedWorkBefore !== 'boolean' ||
    typeof input.holdsFullRights !== 'boolean'
  ) {
    return { ok: false, error: 'Please complete all required fields.' };
  }
  if (!input.holdsFullRights) {
    return {
      ok: false,
      error: 'Please confirm you hold full distribution rights.',
    };
  }
  if (!WALLET_RE.test(paymentWalletAddress)) {
    return { ok: false, error: 'Enter a valid payout wallet address.' };
  }

  // user_id is NOT NULL with no default — an application must be tied to a
  // signed-in account. Never trust a client-supplied id; read it from the
  // session cookie only.
  const session = await getSession();
  if (!session?.userId) {
    return { ok: false, error: 'Please sign in to submit your application.' };
  }

  // One submission per account — the client also disables the form once
  // applied, but a Server Action is a public endpoint on its own, so the
  // real guard has to live here too.
  if (await hasExistingApplication(session.userId)) {
    return {
      ok: false,
      error: 'You have already submitted a creator application.',
    };
  }

  try {
    await db.insert(applications).values({
      userId: session.userId,
      fullName,
      email,
      country,
      hasReleasedWorkBefore: yesNo(input.hasReleasedWorkBefore),
      experience,
      holdsFullRights: yesNo(input.holdsFullRights),
      applicantType,
      paymentWalletAddress: paymentWalletAddress.slice(0, 100),
      portfolioLinks: optional(input.portfolioLinks),
      previousFilmsLink: optional(input.previousFilmsLink),
      previousAwardsLink: optional(input.previousAwardsLink),
      shortBio: optional(input.shortBio),
      consideredGenre: optional(input.consideredGenre, 200),
      coOwnerFullName: optional(input.coOwnerFullName, 400),
      closingStatement: optional(input.closingStatement),
    });
    return { ok: true };
  } catch (err) {
    console.error('[submitCreatorApplication] insert failed:', err);
    return {
      ok: false,
      error: 'Could not submit your application. Please try again.',
    };
  }
}
