import type { NextConfig } from 'next';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Load API keys from repo root .env (same file as CLI scripts)
const rootEnv = join(__dirname, '..', '.env');
if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: join(__dirname, '..'),
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
if (process.env.NODE_ENV !== 'production') {
  initOpenNextCloudflareForDev();
}
