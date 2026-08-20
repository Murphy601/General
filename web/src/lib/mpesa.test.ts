import assert from 'node:assert/strict';
import test from 'node:test';
import { getMpesaConfig } from './mpesa';

test('getMpesaConfig explains missing Daraja secrets', () => {
  const cfg = getMpesaConfig(null, 'https://hightech-cbc-learners.mikeal-murphy.workers.dev/pricing');
  assert.equal('error' in cfg, true);
  if ('error' in cfg) {
    assert.match(cfg.error, /not configured/i);
  }
});

test('getMpesaConfig builds sandbox callback from the request origin', () => {
  const cfg = getMpesaConfig(
    {
      MPESA_CONSUMER_KEY: 'key',
      MPESA_CONSUMER_SECRET: 'secret',
      MPESA_SHORTCODE: '174379',
      MPESA_PASSKEY: 'pass',
      MPESA_ENV: 'sandbox',
    },
    'https://example.com/pricing',
  );
  assert.equal('error' in cfg, false);
  if (!('error' in cfg)) {
    assert.equal(cfg.env, 'sandbox');
    assert.equal(cfg.callbackUrl, 'https://example.com/api/mpesa/callback');
    assert.equal(cfg.shortcode, '174379');
  }
});
