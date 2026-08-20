export type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<{ success: boolean; error?: string }>;
};

export type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
};

export type AppEnv = {
  ASSETS?: { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> };
  DB?: D1Database;
  MPESA_CONSUMER_KEY?: string;
  MPESA_CONSUMER_SECRET?: string;
  MPESA_SHORTCODE?: string;
  MPESA_PASSKEY?: string;
  MPESA_ENV?: string;
  MPESA_CALLBACK_URL?: string;
  APP_URL?: string;
};

let cached: AppEnv | null | undefined;

export async function getAppEnv(): Promise<AppEnv | null> {
  if (cached !== undefined) return cached;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext({ async: true });
    cached = ((ctx?.env as AppEnv) ?? null);
  } catch {
    cached = null;
  }
  return cached;
}

export async function getDb(): Promise<D1Database | null> {
  const env = await getAppEnv();
  return env?.DB ?? null;
}

export function readConfig(env: AppEnv | null, key: keyof AppEnv): string {
  const fromEnv = env?.[key];
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();
  const fromProcess = process.env[key];
  return typeof fromProcess === 'string' ? fromProcess.trim() : '';
}
