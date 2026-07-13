'use server';

import { deleteSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export async function signOut() {
  await deleteSession();
  redirect('/auth/sign-in');
}
