'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { accounts } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';

export async function signUpWithEmail(
  _prev: { error: string } | null,
  formData: FormData,
) {
  const name = (formData.get('name') as string).trim();
  const email = (formData.get('email') as string).trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!name || !email || !password) {
    return { error: 'All fields are required.' };
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  // Check if account already exists
  const [existing] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);

  if (existing) {
    return { error: 'An account with that email already exists.' };
  }

  const passwordHash = await hashPassword(password);

  const [account] = await db
    .insert(accounts)
    .values({ name, email, passwordHash })
    .returning();

  await createSession({
    userId: account.id,
    email: account.email,
    name: account.name,
  });

  redirect('/');
}