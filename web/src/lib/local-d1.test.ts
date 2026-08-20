import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getLocalDb, resetLocalDbCache } from './local-d1';

test('local sqlite D1 can insert and read a user', async () => {
  process.env.LOCAL_ACCOUNTS_DB = join(mkdtempSync(join(tmpdir(), 'htcbc-')), 'accounts.sqlite');
  resetLocalDbCache();
  const db = getLocalDb();
  await db
    .prepare(
      'INSERT INTO users (id, email, password_hash, name, phone, plan, plan_expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind('u1', 'ada@example.com', 'hash', 'Ada', '254712345678', 'free', null, Date.now())
    .run();
  const row = await db.prepare('SELECT email, name, plan FROM users WHERE id = ?').bind('u1').first<{
    email: string;
    name: string;
    plan: string;
  }>();
  assert.equal(row?.email, 'ada@example.com');
  assert.equal(row?.name, 'Ada');
  assert.equal(row?.plan, 'free');
  resetLocalDbCache();
});
