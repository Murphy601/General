#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');

if (!existsSync(envPath)) {
  console.error('\n❌ Missing .env file');
  console.error('   Run:  copy .env.example .env');
  console.error('   Then: notepad .env   (paste your OpenRouter key)\n');
  process.exit(1);
}

const content = readFileSync(envPath, 'utf8');
const keyMatch = content.match(/^OPENAI_API_KEY=(.+)$/m);
const key = keyMatch?.[1]?.trim().replace(/^["']|["']$/g, '');

if (!key || key.includes('PASTE_YOUR') || key === 'your_key_here') {
  console.error('\n❌ OPENAI_API_KEY in .env is missing or still a placeholder');
  console.error('   Edit .env and paste your sk-or-v1-... key from OpenRouter\n');
  process.exit(1);
}

console.log('✓ .env loaded (OPENAI_API_KEY set)');
