import { NextResponse } from 'next/server';
import { attachSession, createSession, createUser, jsonError } from '@/lib/auth';
import { getDb } from '@/lib/env';
import { publicUser } from '@/lib/membership';

export async function POST(request: Request) {
  if (!(await getDb())) return jsonError('Accounts are unavailable until the site database is bound.', 503);
  let body: { email?: string; password?: string; name?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Send JSON with name, email, and password.');
  }
  try {
    const user = await createUser({
      email: String(body.email || ''),
      password: String(body.password || ''),
      name: String(body.name || ''),
      phone: body.phone ? String(body.phone) : undefined,
    });
    if (!user) return jsonError('Could not create the account.', 500);
    const sessionId = await createSession(user.id);
    const res = NextResponse.json({ ok: true, user: publicUser(user) });
    return attachSession(res, sessionId);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Could not create the account.');
  }
}
