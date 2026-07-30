#!/usr/bin/env node
/**
 * Batch queue: generate ≥ PAPERS_PER_SUBJECT unique G8 IS papers per tier.
 * Agent 5 — Exam Generator
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePaper, TIER_META } from './study-drama/exam-generator.mjs';
import { CONFIG } from './study-drama/config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'web', 'data', 'content');
const INDEX_FILE = join(CONTENT_DIR, 'index.json');
const LEDGER_FILE = join(ROOT, 'knowledge-base', 'phase5', 'study-drama-exam-ledger.json');

const TARGET = CONFIG.PAPERS_PER_SUBJECT;

function loadIndex() {
  if (!existsSync(INDEX_FILE)) return [];
  return JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
}

function loadLedger() {
  if (!existsSync(LEDGER_FILE)) return { usedItems: [], papers: [] };
  return JSON.parse(readFileSync(LEDGER_FILE, 'utf8'));
}

function saveLedger(ledger) {
  mkdirSync(dirname(LEDGER_FILE), { recursive: true });
  writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
}

function saveRecord(content) {
  mkdirSync(CONTENT_DIR, { recursive: true });
  let index = loadIndex();
  // Replace same tier+index study-drama exam only
  const same = (i) =>
    i.type === content.type &&
    i.topic?.grade === 'grade-8' &&
    /INTEGRATED\s*SCIENCE/i.test(String(i.topic?.subject || '')) &&
    i.metadata?.contentSource === 'study-drama-exam-v1' &&
    i.metadata?.paperTier === content.metadata.paperTier &&
    i.metadata?.paperIndex === content.metadata.paperIndex &&
    (i.metadata?.term || null) === (content.metadata.term || null);

  for (const old of index.filter(same)) {
    const p = join(CONTENT_DIR, `${old.id}.json`);
    if (existsSync(p) && old.id !== content.id) {
      try {
        unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
  index = index.filter((i) => !same(i) && i.id !== content.id);
  const { _usedItemIds, ...store } = content;
  writeFileSync(join(CONTENT_DIR, `${store.id}.json`), JSON.stringify(store, null, 2));
  index.unshift({
    ...store,
    pages: {
      ...store.pages,
      quiz: (store.pages.quiz || '').slice(0, 240) + '…',
      answers: (store.pages.answers || '').slice(0, 200) + '…',
    },
  });
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

const ledger = loadLedger();
const used = new Set(ledger.usedItems || []);
let created = 0;

console.log(`Study-Drama Exam batch — ${CONFIG.SUBJECT} ${CONFIG.GRADE} · ${TARGET} papers/tier`);

// GENERAL × 20
for (let i = 0; i < TARGET; i++) {
  const paper = generatePaper({ tier: 'GENERAL', paperIndex: i, usedItems: used });
  saveRecord(paper);
  ledger.papers.push({ tier: 'GENERAL', index: i + 1, id: paper.id });
  created++;
}

// TERMLY × 20 (cycle terms 1–3)
for (let i = 0; i < TARGET; i++) {
  const term = (i % 3) + 1;
  const paper = generatePaper({ tier: 'TERMLY', paperIndex: i, term, usedItems: used });
  saveRecord(paper);
  ledger.papers.push({ tier: 'TERMLY', term, index: i + 1, id: paper.id });
  created++;
}

// MOCK × 20
for (let i = 0; i < TARGET; i++) {
  const paper = generatePaper({ tier: 'MOCK', paperIndex: i, usedItems: used });
  saveRecord(paper);
  ledger.papers.push({ tier: 'MOCK', index: i + 1, id: paper.id });
  created++;
}

// PREMIUM × 20
for (let i = 0; i < TARGET; i++) {
  const paper = generatePaper({ tier: 'PREMIUM', paperIndex: i, usedItems: used });
  saveRecord(paper);
  ledger.papers.push({ tier: 'PREMIUM', index: i + 1, id: paper.id });
  created++;
}

ledger.usedItems = [...used];
ledger.updatedAt = new Date().toISOString();
ledger.papersPerTier = TARGET;
saveLedger(ledger);

console.log(`Created/updated ${created} papers (${TARGET} × ${Object.keys(TIER_META).length} tiers).`);
console.log(`Ledger: ${LEDGER_FILE}`);
console.log('Done.');
