import assert from 'node:assert/strict';
import test from 'node:test';
import { canReadStudyPage, freeStudyPageCount, subscriberUnlocksLessons } from './access';

test('defaults to 3 free study pages', () => {
  assert.equal(freeStudyPageCount(undefined), 3);
  assert.equal(freeStudyPageCount({ freePageCount: 5 }), 5);
});

test('only monthly/termly subscribers unlock remaining pages', () => {
  assert.equal(subscriberUnlocksLessons(null), false);
  assert.equal(
    subscriberUnlocksLessons({
      id: '1',
      email: 'a@b.c',
      name: 'Ada',
      phone: null,
      plan: 'single',
      planExpiresAt: Date.now() + 1000,
      planActive: true,
    }),
    false,
  );
  assert.equal(
    subscriberUnlocksLessons({
      id: '1',
      email: 'a@b.c',
      name: 'Ada',
      phone: null,
      plan: 'monthly',
      planExpiresAt: Date.now() + 1000,
      planActive: true,
    }),
    true,
  );
});

test('free preview is pages 1–freeCount unless unlocked', () => {
  assert.equal(canReadStudyPage({ pageNumber: 1, freeCount: 3, unlocked: false }), true);
  assert.equal(canReadStudyPage({ pageNumber: 4, freeCount: 3, unlocked: false }), false);
  assert.equal(canReadStudyPage({ pageNumber: 4, freeCount: 3, unlocked: true }), true);
});
