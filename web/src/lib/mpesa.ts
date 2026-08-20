import { getAppEnv, readConfig, type AppEnv } from './env';

export type StkPushResult = {
  merchantRequestId: string;
  checkoutRequestId: string;
  customerMessage: string;
};

export type StkQueryResult = {
  resultCode: number;
  resultDesc: string;
};

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

function eatTimestamp(now = Date.now()): string {
  const eat = new Date(now + 3 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${eat.getUTCFullYear()}${p(eat.getUTCMonth() + 1)}${p(eat.getUTCDate())}${p(eat.getUTCHours())}${p(eat.getUTCMinutes())}${p(eat.getUTCSeconds())}`;
}

function bytesToB64(value: string): string {
  return btoa(value);
}

export type MpesaConfig = {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  env: 'sandbox' | 'production';
  callbackUrl: string;
};

export function getMpesaConfig(env: AppEnv | null, requestUrl: string): MpesaConfig | { error: string } {
  const consumerKey = readConfig(env, 'MPESA_CONSUMER_KEY');
  const consumerSecret = readConfig(env, 'MPESA_CONSUMER_SECRET');
  const shortcode = readConfig(env, 'MPESA_SHORTCODE');
  const passkey = readConfig(env, 'MPESA_PASSKEY');
  const rawEnv = (readConfig(env, 'MPESA_ENV') || 'sandbox').toLowerCase();
  const envName: 'sandbox' | 'production' = rawEnv === 'production' ? 'production' : 'sandbox';
  if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
    return {
      error:
        'M-Pesa is not configured. Add Daraja consumer key, consumer secret, shortcode, and passkey as Cloudflare Worker secrets.',
    };
  }
  const appUrl = readConfig(env, 'APP_URL') || new URL(requestUrl).origin;
  const callbackUrl = readConfig(env, 'MPESA_CALLBACK_URL') || `${appUrl.replace(/\/$/, '')}/api/mpesa/callback`;
  return { consumerKey, consumerSecret, shortcode, passkey, env: envName, callbackUrl };
}

function baseUrl(envName: 'sandbox' | 'production') {
  return envName === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
}

async function getToken(cfg: MpesaConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
  const auth = bytesToB64(`${cfg.consumerKey}:${cfg.consumerSecret}`);
  const res = await fetch(`${baseUrl(cfg.env)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: string; errorMessage?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(body.errorMessage || 'Could not get an M-Pesa access token.');
  }
  const ttl = Number(body.expires_in || 3599) * 1000;
  tokenCache = { token: body.access_token, expiresAt: Date.now() + ttl };
  return body.access_token;
}

function stkPassword(cfg: MpesaConfig, timestamp: string): string {
  return bytesToB64(`${cfg.shortcode}${cfg.passkey}${timestamp}`);
}

export async function stkPush(input: {
  requestUrl: string;
  amountKes: number;
  phone: string;
  accountRef: string;
  description: string;
}): Promise<StkPushResult> {
  const env = await getAppEnv();
  const cfg = getMpesaConfig(env, input.requestUrl);
  if ('error' in cfg) throw new Error(cfg.error);
  const token = await getToken(cfg);
  const timestamp = eatTimestamp();
  const res = await fetch(`${baseUrl(cfg.env)}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: cfg.shortcode,
      Password: stkPassword(cfg, timestamp),
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: input.amountKes,
      PartyA: input.phone,
      PartyB: cfg.shortcode,
      PhoneNumber: input.phone,
      CallBackURL: cfg.callbackUrl,
      AccountReference: input.accountRef.slice(0, 12),
      TransactionDesc: input.description.slice(0, 13),
    }),
  });
  const body = (await res.json()) as {
    ResponseCode?: string;
    MerchantRequestID?: string;
    CheckoutRequestID?: string;
    CustomerMessage?: string;
    ResponseDescription?: string;
    errorMessage?: string;
    errorCode?: string;
  };
  if (!res.ok || body.ResponseCode !== '0' || !body.CheckoutRequestID || !body.MerchantRequestID) {
    throw new Error(body.errorMessage || body.ResponseDescription || 'M-Pesa did not accept the STK Push.');
  }
  return {
    merchantRequestId: body.MerchantRequestID,
    checkoutRequestId: body.CheckoutRequestID,
    customerMessage: body.CustomerMessage || 'Check your phone for the M-Pesa PIN prompt.',
  };
}

export async function stkQuery(requestUrl: string, checkoutRequestId: string): Promise<StkQueryResult> {
  const env = await getAppEnv();
  const cfg = getMpesaConfig(env, requestUrl);
  if ('error' in cfg) throw new Error(cfg.error);
  const token = await getToken(cfg);
  const timestamp = eatTimestamp();
  const res = await fetch(`${baseUrl(cfg.env)}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: cfg.shortcode,
      Password: stkPassword(cfg, timestamp),
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });
  const body = (await res.json()) as {
    ResultCode?: string | number;
    ResultDesc?: string;
    errorMessage?: string;
    ResponseCode?: string;
  };
  if (body.ResultCode == null) {
    throw new Error(body.errorMessage || 'Could not query M-Pesa payment status.');
  }
  return {
    resultCode: Number(body.ResultCode),
    resultDesc: body.ResultDesc || '',
  };
}

export function callbackMeta(items: Array<{ Name?: string; Value?: string | number }> | undefined) {
  const map: Record<string, string | number | undefined> = {};
  for (const item of items || []) {
    if (item?.Name) map[item.Name] = item.Value;
  }
  return {
    amount: map.Amount,
    receipt: map.MpesaReceiptNumber != null ? String(map.MpesaReceiptNumber) : undefined,
    phone: map.PhoneNumber != null ? String(map.PhoneNumber) : undefined,
  };
}
