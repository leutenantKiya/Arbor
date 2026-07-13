'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { accounts } from '@/lib/db/schema';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';

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

  await createSession({
    userId: account.id,
    email: account.email,
    name: account.name,
  });

  redirect('/');
}