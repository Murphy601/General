#!/usr/bin/env node
/**
 * Batch-generate revision content (notes + quiz) for all grades/subjects/topics.
 *
 * Usage:
 *   node scripts/batch-generate-revision.mjs --grade grade-7
 *   node scripts/batch-generate-revision.mjs --grade grade-7 --subject Agriculture
 *   node scripts/batch-generate-revision.mjs --all
 *   node scripts/batch-generate-revision.mjs --grade grade-4 --dry-run
 */
import './load-env.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getContextChunks, formatGradeLabel, INDEX_PATH } from './curriculum-source.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'web', 'data', 'content');
const INDEX_FILE = join(CONTENT_DIR, 'index.json');
const MANIFEST = join(__dirname, '..', 'knowledge-base', 'phase5', 'generation-manifest.json');

const API_BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'openai/gpt-4o-mini';

function parseArgs(argv) {
  const args = { grade: null, subject: null, all: false, dryRun: false, types: ['notes', 'quiz'], delayMs: 1500 };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--grade') args.grade = argv[++i];
    else if (argv[i] === '--subject') args.subject = argv[++i];
    else if (argv[i] === '--all') args.all = true;
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--types') args.types = argv[++i].split(',');
    else if (argv[i] === '--delay') args.delayMs = Number(argv[++i]);
  }
  return args;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function revisionNotesPrompt(topic) {
  return `You are an expert Kenyan CBC revision content writer.

Create REVISION NOTES for parents and learners. Use clear structure with numbers, letters, and bullet points.

Grade: ${topic.gradeLabel}
Subject: ${topic.subject}
Strand: ${topic.strand}
${topic.subStrand ? `Sub-strand: ${topic.subStrand}` : ''}

Format EXACTLY like this:

# ${topic.subject} — ${topic.strand}

## 1. Quick Summary
(3-5 bullet points learners must remember)

## 2. Key Concepts
### A. ...
### B. ...
(Use Kenyan examples — local foods, places, practices)

## 3. Learning Outcomes
1. ...
2. ...
(Number each outcome from the curriculum)

## 4. Revision Questions
**A.** Multiple choice (4 options each) — at least 3 questions
**B.** Short answer — at least 2 questions

## 5. Parent Tip
One simple home activity.

Rules: Simple English. Kenyan context only. Ground in the provided KICD excerpts.`;
}

function revisionQuizPrompt(topic) {
  return `Create a TOPICAL REVISION QUIZ as valid JSON only:
{
  "title": "...",
  "questions": [
    {"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}
  ]
}

Grade: ${topic.gradeLabel} | Subject: ${topic.subject} | Strand: ${topic.strand}
Generate 8 multiple-choice questions. Use Kenyan examples. Ground in curriculum excerpts.`;
}

async function callLLM(systemPrompt, context, task) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY in .env');

  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `KICD curriculum excerpts:\n\n${context}\n\n---\n\n${task}` },
      ],
      temperature: 0.3,
      max_tokens: 3500,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.choices[0].message.content;
}

function loadManifest() {
  if (!existsSync(MANIFEST)) return { completed: [] };
  return JSON.parse(readFileSync(MANIFEST, 'utf8'));
}

function saveManifest(manifest) {
  mkdirSync(dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
}

function loadContentIndex() {
  if (!existsSync(INDEX_FILE)) return [];
  return JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
}

function saveContent(content) {
  mkdirSync(CONTENT_DIR, { recursive: true });
  writeFileSync(join(CONTENT_DIR, `${content.id}.json`), JSON.stringify(content, null, 2));
  const index = loadContentIndex().filter((i) => i.id !== content.id);
  index.unshift({ ...content, body: `${content.body.slice(0, 300)}…` });
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

function topicKey(grade, subject, strand, type) {
  return `${grade}|${subject}|${strand}|${type}`;
}

async function generateForTopic(topic, types, dryRun) {
  const context = getContextChunks({
    grade: topic.grade,
    subject: topic.subject,
    strand: topic.strand !== 'General' ? topic.strand : undefined,
    subStrand: topic.subStrand,
    maxChunks: 4,
  });

  if (!context.length) {
    console.log(`  SKIP (no source text): ${topic.grade} ${topic.subject} ${topic.strand}`);
    return [];
  }

  const ctx = context.map((c, i) => `[${i + 1}] ${c.text.slice(0, 6000)}`).join('\n\n');
  const results = [];

  for (const type of types) {
    if (dryRun) {
      console.log(`  DRY RUN: would generate ${type} for ${topic.strand}`);
      continue;
    }

    const gradeLabel = formatGradeLabel(topic.grade);
    let body = '';
    let title = '';
    const metadata = {
      createdAt: new Date().toISOString(),
      wordCount: 0,
      reviewed: false,
      access: 'paid',
      priceKes: 100,
    };

    if (type === 'notes') {
      body = await callLLM(revisionNotesPrompt({ ...topic, gradeLabel }), ctx, 'Write the revision notes now.');
      title = `${gradeLabel} ${topic.subject} — ${topic.strand}`;
    } else if (type === 'quiz') {
      const raw = await callLLM(revisionQuizPrompt({ ...topic, gradeLabel }), ctx, 'Return JSON only.');
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        title = parsed.title || `${gradeLabel} ${topic.subject} Quiz — ${topic.strand}`;
        metadata.questions = parsed.questions;
        body = (parsed.questions || [])
          .map((q, i) => `**${i + 1}.** ${q.question}\n${(q.options || []).map((o, j) => `   ${String.fromCharCode(65 + j)}. ${o}`).join('\n')}`)
          .join('\n\n');
      } else {
        body = raw;
        title = `${gradeLabel} ${topic.subject} Quiz`;
      }
    }

    metadata.wordCount = body.split(/\s+/).length;
    const content = {
      id: randomUUID(),
      type,
      title,
      topic: {
        grade: topic.grade,
        gradeLabel,
        subject: topic.subject,
        strand: topic.strand,
        subStrand: topic.subStrand,
      },
      body,
      metadata,
      sources: context.slice(0, 2).map((s) => ({
        id: s.id,
        subject: s.subject,
        grade: s.grade,
        excerpt: s.text.slice(0, 150),
      })),
    };

    saveContent(content);
    results.push(content);
    console.log(`  ✓ ${type}: ${title}`);
  }

  return results;
}

const args = parseArgs(process.argv);

if (!existsSync(INDEX_PATH)) {
  console.error('Run first: node scripts/build-curriculum-index.mjs');
  process.exit(1);
}

const curriculumIndex = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
const manifest = loadManifest();
let grades = curriculumIndex.grades;

if (args.grade) grades = grades.filter((g) => g.grade === args.grade);
if (!args.all && !args.grade) {
  console.error('Specify --grade grade-7 or --all');
  process.exit(1);
}

console.log(`Generating for ${grades.length} grade(s), types: ${args.types.join(', ')}`);

let generated = 0;
let skipped = 0;

for (const gradeEntry of grades) {
  console.log(`\n=== ${gradeEntry.label} (${gradeEntry.grade}) ===`);
  const subjects = Object.values(gradeEntry.subjects);
  const filtered = args.subject
    ? subjects.filter((s) => s.subject.toLowerCase().includes(args.subject.toLowerCase()))
    : subjects;

  for (const subj of filtered) {
    console.log(`\n-- ${subj.subject} (${subj.topics.length} topics) --`);
    for (const topic of subj.topics) {
      for (const type of args.types) {
        const key = topicKey(gradeEntry.grade, subj.subject, topic.strand, type);
        if (manifest.completed.includes(key)) {
          skipped += 1;
          continue;
        }

        try {
          await generateForTopic(
            {
              grade: gradeEntry.grade,
              subject: subj.subject,
              strand: topic.strand,
              subStrand: topic.subStrands?.[0],
            },
            [type],
            args.dryRun,
          );
          if (!args.dryRun) {
            manifest.completed.push(key);
            saveManifest(manifest);
            generated += 1;
          }
          await sleep(args.delayMs);
        } catch (err) {
          console.error(`  ERROR: ${err.message}`);
        }
      }
    }
  }
}

console.log(`\nDone. Generated: ${generated}, skipped (already done): ${skipped}`);
