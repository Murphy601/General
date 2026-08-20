import { NextResponse } from 'next/server';
import { attachSession, authenticate, createSession, jsonError } from '@/lib/auth';
import { getDb } from '@/lib/env';
import { publicUser } from '@/lib/membership';

export async function POST(request: Request) {
  if (!(await getDb())) return jsonError('Accounts are unavailable until the site database is bound.', 503);
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Send JSON with email and password.');
  }
  try {
    const user = await authenticate(String(body.email || ''), String(body.password || ''));
    const sessionId = await createSession(user.id);
    const res = NextResponse.json({ ok: true, user: publicUser(user) });
    return attachSession(res, sessionId);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Could not sign in.');
  }
}
