import assert from 'node:assert/strict';
import test from 'node:test';
import { isPlanActive, nextExpiry, publicUser, shouldReplacePlan } from './membership';

test('free plans are never active', () => {
  assert.equal(isPlanActive('free', null), false);
});

test('monthly/termly are active until expiry', () => {
  const future = Date.now() + 60_000;
  assert.equal(isPlanActive('monthly', future), true);
  assert.equal(isPlanActive('monthly', Date.now() - 1), false);
});

test('nextExpiry extends from remaining time', () => {
  const now = 1_700_000_000_000;
  const month = 30 * 24 * 60 * 60 * 1000;
  assert.equal(nextExpiry('monthly', null, now), now + month);
  assert.equal(nextExpiry('monthly', now + 10, now), now + 10 + month);
});

test('shouldReplacePlan upgrades or renews', () => {
  const now = Date.now();
  assert.equal(shouldReplacePlan('free', null, 'monthly', now), true);
  assert.equal(shouldReplacePlan('termly', now + 10_000, 'monthly', now), false);
  assert.equal(shouldReplacePlan('monthly', now + 10_000, 'termly', now), true);
});

test('publicUser downgrades expired plans to free', () => {
  const view = publicUser({
    id: '1',
    email: 'a@b.c',
    name: 'Ada',
    phone: null,
    plan: 'monthly',
    plan_expires_at: Date.now() - 1,
  });
  assert.equal(view.plan, 'free');
  assert.equal(view.planActive, false);
});
