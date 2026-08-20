#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, NEXT_PRIVATE_WORKER_THREADS: 'false' };

function run(cmd) {
  console.log(cmd);
  execSync(cmd, { cwd: web, stdio: 'inherit', env });
}

run('npx next build');
run('node ./scripts/ensure-pages-manifest.mjs');
run('npx opennextjs-cloudflare build --skipNextBuild');
run('npx opennextjs-cloudflare deploy');
