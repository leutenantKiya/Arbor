'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { accounts, users } from '@/lib/db/schema';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { DEV_SEED_BALANCE_SECONDS } from '@/lib/billing';

export async function signInWithEmail(
  _prev: { error: string } | null,
  formData: FormData,
) {
  const email = (formData.get('email') as string).trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);

  if (!account) {
    return { error: 'Invalid email or password.' };
  }

  const valid = await verifyPassword(password, account.passwordHash);
  if (!valid) {
    return { error: 'Invalid email or password.' };
  }

  // Resolve (or lazily create) the canonical ledger user linked to this
  // password account. The session ALWAYS carries users.id so that every
  // downstream ledger read keys on one identity regardless of login method
  // (Particle sign-in signs users.id too). account_id is the link.
  let [ledgerUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.accountId, account.id))
    .limit(1);

  if (!ledgerUser) {
    [ledgerUser] = await db
      .insert(users)
      .values({
        // password accounts have no Particle identity — a stable placeholder
        // keeps the NOT NULL / UNIQUE particle_uuid constraint satisfied
        particleUuid: `account:${account.id}`,
        accountId: account.id,
        walletAddress: account.walletAddress,
        balanceSeconds: DEV_SEED_BALANCE_SECONDS,
      })
      .returning({ id: users.id });
  }

  await createSession({
    userId: ledgerUser.id,
    email: account.email,
    name: account.name,
  });

  redirect('/');
}
