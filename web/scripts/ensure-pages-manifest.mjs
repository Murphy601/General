#!/usr/bin/env node
/**
 * Next.js App Router does not always emit pages-manifest.json.
 * OpenNext still reads it from the standalone output.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const empty = JSON.stringify({
  '/_app': 'pages/_app.js',
  '/_document': 'pages/_document.js',
  '/_error': 'pages/_error.js',
});

const dirs = [
  join(process.cwd(), '.next/server'),
  join(process.cwd(), '.next/standalone/.next/server'),
  join(process.cwd(), '.next/standalone/web/.next/server'),
];

for (const dir of dirs) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'pages-manifest.json');
  if (!existsSync(file)) writeFileSync(file, empty);
  console.log('ensured', file);
}
