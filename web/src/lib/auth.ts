import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDb } from './env';
import { hashPassword, verifyPassword } from './password';
import { normalizeKenyaPhone } from './phone';
import { publicUser, type PublicUser } from './membership';

export const SESSION_COOKIE = 'htc_session';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  phone: string | null;
  plan: string;
  plan_expires_at: number | null;
  created_at: number;
};

export type SessionRow = {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
};

function newId(): string {
  return crypto.randomUUID();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function attachSession(res: NextResponse, sessionId: string) {
  res.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MS / 1000,
  });
  return res;
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}

export async function createUser(input: { email: string; password: string; name: string; phone?: string }) {
  const db = await getDb();
  if (!db) throw new Error('Accounts are unavailable (database not bound).');
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const password = input.password;
  if (!validEmail(email)) throw new Error('Enter a valid email address.');
  if (name.length < 2) throw new Error('Enter your name.');
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');
  let phone: string | null = null;
  if (input.phone?.trim()) {
    phone = normalizeKenyaPhone(input.phone);
    if (!phone) throw new Error('Enter a valid Kenyan phone such as 07XX XXX XXX.');
  }
  const now = Date.now();
  const id = newId();
  const passwordHash = await hashPassword(password);
  try {
    await db
      .prepare(
        'INSERT INTO users (id, email, password_hash, name, phone, plan, plan_expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(id, email, passwordHash, name, phone, 'free', null, now)
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique/i.test(msg)) throw new Error('An account with that email already exists.');
    throw err;
  }
  return getUserById(id);
}

export async function authenticate(emailRaw: string, password: string): Promise<UserRow> {
  const db = await getDb();
  if (!db) throw new Error('Accounts are unavailable (database not bound).');
  const email = normalizeEmail(emailRaw);
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new Error('Invalid email or password.');
  }
  return user;
}

export async function createSession(userId: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('Accounts are unavailable (database not bound).');
  const id = newId();
  const now = Date.now();
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, userId, now + SESSION_MS, now)
    .run();
  return id;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const db = await getDb();
  if (!db) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

export async function getSessionUser(): Promise<UserRow | null> {
  const db = await getDb();
  if (!db) return null;
  let sessionId: string | undefined;
  try {
    const jar = await cookies();
    sessionId = jar.get(SESSION_COOKIE)?.value;
  } catch {
    return null;
  }
  if (!sessionId) return null;
  const session = await db.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionId).first<SessionRow>();
  if (!session || session.expires_at < Date.now()) {
    if (session) await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
    return null;
  }
  return getUserById(session.user_id);
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return publicUser(user);
}

export async function destroySession() {
  const db = await getDb();
  let sessionId: string | undefined;
  try {
    const jar = await cookies();
    sessionId = jar.get(SESSION_COOKIE)?.value;
  } catch {
    return;
  }
  if (db && sessionId) {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
  }
}

export async function requireUser(): Promise<UserRow> {
  const user = await getSessionUser();
  if (!user) throw new Error('Sign in to continue.');
  return user;
}
