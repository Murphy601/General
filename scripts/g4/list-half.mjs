#!/usr/bin/env node
// Usage: node scripts/g4/list-half.mjs <subject-slug> <A|B|all>  -> lesson files assigned to that agent
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
const [slug, half = 'all'] = process.argv.slice(2);
const files = readdirSync(join(import.meta.dirname, '..', '..', 'content-authoring', 'grade-4', slug, 'lessons')).filter((f) => f.endsWith('.md')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const cut = Math.ceil(files.length / 2);
console.log((half === 'A' ? files.slice(0, cut) : half === 'B' ? files.slice(cut) : files).join('\n'));
