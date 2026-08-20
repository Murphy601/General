import { NextResponse } from 'next/server';
import { clearSessionCookie, destroySession } from '@/lib/auth';

export async function POST() {
  await destroySession();
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
