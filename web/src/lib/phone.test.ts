import assert from 'node:assert/strict';
import test from 'node:test';
import { formatKenyaPhone, normalizeKenyaPhone } from './phone';

test('normalizes Kenyan mobiles to 254…', () => {
  assert.equal(normalizeKenyaPhone('0712 345 678'), '254712345678');
  assert.equal(normalizeKenyaPhone('+254712345678'), '254712345678');
  assert.equal(normalizeKenyaPhone('712345678'), '254712345678');
  assert.equal(normalizeKenyaPhone('0112345678'), '254112345678');
});

test('rejects invalid phones', () => {
  assert.equal(normalizeKenyaPhone('123'), null);
  assert.equal(normalizeKenyaPhone('25471234567'), null);
  assert.equal(normalizeKenyaPhone('0212345678'), null);
});

test('formats 254… back to 07…', () => {
  assert.equal(formatKenyaPhone('254712345678'), '0712345678');
});
