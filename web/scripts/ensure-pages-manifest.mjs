#!/usr/bin/env node
/**
 * Next.js App Router + a parent package.json emits standalone/web/.next
 * while OpenNext reads standalone/.next. Copy the nested tree and ensure
 * pages-manifest.json exists (App Router does not always write it).
 */
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const empty = JSON.stringify({
  '/_app': 'pages/_app.js',
  '/_document': 'pages/_document.js',
  '/_error': 'pages/_error.js',
});

const nested = join(process.cwd(), '.next/standalone/web/.next');
const dest = join(process.cwd(), '.next/standalone/.next');
if (existsSync(nested)) {
  cpSync(nested, dest, { recursive: true });
  console.log('flattened standalone/web/.next -> standalone/.next');
}

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
