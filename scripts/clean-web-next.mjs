#!/usr/bin/env node
import { rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const nextDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', '.next');

if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true });
  console.log('Removed web/.next');
} else {
  console.log('web/.next not found (nothing to clean)');
}
