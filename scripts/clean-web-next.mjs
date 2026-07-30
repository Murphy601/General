#!/usr/bin/env node
/**
 * Remove web/.next safely on Windows (retries when files are briefly locked).
 */
import { rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const nextDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', '.next');

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* busy wait — sync retry only */
  }
}

function tryRemove() {
  if (!existsSync(nextDir)) {
    console.log('web/.next not found (nothing to clean)');
    return true;
  }

  // Prefer Node rmSync; fall back to platform shell if needed.
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      rmSync(nextDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      if (!existsSync(nextDir)) {
        console.log('Removed web/.next');
        return true;
      }
    } catch (err) {
      if (attempt === 5) {
        // Last resort on Windows: cmd rmdir
        try {
          if (process.platform === 'win32') {
            execSync(`cmd /c "rmdir /s /q \\"${nextDir}\\""`, { stdio: 'ignore' });
          } else {
            execSync(`rm -rf "${nextDir}"`, { stdio: 'ignore' });
          }
          if (!existsSync(nextDir)) {
            console.log('Removed web/.next');
            return true;
          }
        } catch {
          /* fall through */
        }
        console.error(`Could not remove web/.next (${err.code || err.message}).`);
        console.error('Stop any running Next.js/Node process, then retry:');
        console.error('  Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force');
        console.error('  npm run web:clean');
        return false;
      }
      sleep(300 * attempt);
    }
  }
  return false;
}

const ok = tryRemove();
process.exit(ok ? 0 : 1);
