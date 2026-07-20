#!/usr/bin/env node
/**
 * Generate comprehensive topic lessons from full KICD sub-strand text.
 * Base layer: full KICD expansion (no summarising). Optional LLM enrichment when API key is set.
 *
 * Usage:
 *   node scripts/batch-generate-lessons.mjs --grade grade-4
 *   node scripts/batch-generate-lessons.mjs --grade grade-4 --subject "SOCIAL STUDIES"
 *   node scripts/batch-generate-lessons.mjs --all
 *   node scripts/batch-generate-lessons.mjs --grade grade-4 --no-llm
 */
import './load-env.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatGradeLabel, isKiswahiliSubject, INDEX_PATH, getTopicSourceText, displayTopicName } from './curriculum-source.mjs';
import {
  buildLessonFromKicd,
  buildQuizFromKicd,
  buildVideoScriptFromKicd,
  formatQuizPages,
  stripMarkdown,
} from './lesson-from-kicd.mjs';
import {
  findTextbookSources,
} from './textbook-lesson.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'web', 'data', 'content');
const INDEX_FILE = join(CONTENT_DIR, 'index.json');
const MANIFEST = join(__dirname, '..', 'knowledge-base', 'phase5', 'generation-manifest.json');
const API_BASE = (process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'openai/gpt-4o-mini';

function parseArgs(argv) {
  const args = {
    grade: null,
    subject: null,
    all: false,
    dryRun: false,
    delayMs: 2000,
    reset: false,
    noLlm: false,
    enrich: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--grade') args.grade = argv[++i];
    else if (argv[i] === '--subject') args.subject = argv[++i];
    else if (argv[i] === '--all') args.all = true;
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--delay') args.delayMs = Number(argv[++i]);
    else if (argv[i] === '--reset') args.reset = true;
    else if (argv[i] === '--no-llm') args.noLlm = true;
    else if (argv[i] === '--enrich') args.enrich = true;
  }
  return args;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function lessonEnrichPrompt(topic, lang, baseLesson) {
  return `You are an expert Kenyan CBC teacher. EXPAND the lesson below using the FULL KICD curriculum text.
Do NOT shorten or summarise. Add explanations, Kenyan examples, and parent activities.
Write at least 800 additional words. PLAIN TEXT ONLY — no # or ** or markdown.
Language: ${lang}
Grade: ${topic.gradeLabel}, Subject: ${topic.subject}, Topic: ${topic.topicName}

Keep all section headings in CAPS. Keep all KICD learning outcomes.

CURRENT LESSON:
${baseLesson.slice(0, 6000)}`;
}

async function callLLM(systemPrompt, userContent, maxTokens = 7000) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.35,
      max_tokens: maxTokens,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.choices[0].message.content;
}

function topicKey(t) {
  return `v9|${t.grade}|${t.subject}|${t.topicNumber}|${t.topicName}`;
}

function loadManifest() {
  if (!existsSync(MANIFEST)) return { version: 3, completed: [] };
  return JSON.parse(readFileSync(MANIFEST, 'utf8'));
}

function saveManifest(m) {
  mkdirSync(dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
}

function saveContent(content) {
  mkdirSync(CONTENT_DIR, { recursive: true });
  let index = [];
  if (existsSync(INDEX_FILE)) index = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));

  // Replace any previous lesson for the same grade/subject/topic
  const sameTopic = (i) =>
    i.type === 'topic-lesson' &&
    i.topic?.grade === content.topic.grade &&
    String(i.topic?.subject || '').toUpperCase() === String(content.topic.subject || '').toUpperCase() &&
    i.topic?.topicNumber === content.topic.topicNumber;

  for (const old of index.filter(sameTopic)) {
    const oldPath = join(CONTENT_DIR, `${old.id}.json`);
    if (existsSync(oldPath) && old.id !== content.id) {
      try { writeFileSync(oldPath, ''); } catch { /* ignore */ }
    }
  }
  index = index.filter((i) => i.id !== content.id && !sameTopic(i));

  writeFileSync(join(CONTENT_DIR, `${content.id}.json`), JSON.stringify(content, null, 2));
  index.unshift({
    ...content,
    body: '',
    pages: {
      lesson: content.pages.lesson.slice(0, 200) + '…',
      quiz: '',
      answers: '',
    },
  });
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

async function generateTopic(topic, options) {
  const lang = isKiswahiliSubject(topic.subject) ? 'Kiswahili' : 'Kenyan English';
  const gradeLabel = formatGradeLabel(topic.grade);
  const meta = { ...topic, gradeLabel };

  if (options.dryRun) {
    console.log(`  DRY: ${topic.topicNumber} ${topic.topicName} (${topic.rawText?.length || 0} chars source)`);
    return;
  }

  let sourceText = topic.rawText || '';
  if (sourceText.length < 200) {
    const lookedUp = getTopicSourceText({
      grade: topic.grade,
      subject: topic.subject,
      topicNumber: topic.topicNumber,
      topicName: topic.topicName,
    });
    sourceText = lookedUp?.rawText || '';
    if (lookedUp) {
      meta.rawText = sourceText;
      meta.strandName = lookedUp.strandName || meta.strandName || meta.strand;
      meta.topicName = displayTopicName(lookedUp.topicName || topic.topicName);
      topic.rawText = sourceText;
    }
  }
  meta.rawText = sourceText;
  meta.topicName = displayTopicName(meta.topicName || topic.topicName);

  const textbooks = findTextbookSources(meta);
  // Pupil-book images only — never paste radio/programme scripts into lessons.
  const imageLines = [];
  for (const book of textbooks.filter((t) => t.kind === 'pupil-book')) {
    for (const page of (book.pages || []).slice(0, 4)) {
      if (page.image) {
        imageLines.push(`[[image:${page.image}|${book.title} — page ${page.page}]]`);
      }
    }
  }

  // Always build classroom study notes (Strategy 2). Short design text is OK when packs exist.
  if (sourceText.length < 80 && imageLines.length === 0) {
    // still generate from topic-name packs
  }

  console.log(
    `  Generating: ${topic.topicNumber} ${topic.topicName} (${sourceText.length} chars design` +
      `${imageLines.length ? `, ${imageLines.length} pupil image(s)` : ', study-pack'})...`,
  );

  meta.imageLines = imageLines;
  let lesson = stripMarkdown(buildLessonFromKicd(meta));
  let quizData = buildQuizFromKicd(meta);
  const { quiz, answers } = formatQuizPages(quizData, meta);
  const videoScript = buildVideoScriptFromKicd(meta);

  const hasApi = Boolean(process.env.OPENAI_API_KEY) && !options.noLlm;
  if (hasApi && options.enrich) {
    try {
      const enrichContext = `KICD DESIGN:\n${sourceText.slice(0, 5000)}\n\nCURRENT LESSON:\n${lesson.slice(0, 4000)}`;
      const enriched = await callLLM(lessonEnrichPrompt(meta, lang, lesson), enrichContext, 8000);
      lesson = stripMarkdown(enriched);
      await sleep(1000);
    } catch (err) {
      console.log(`  LLM enrich skipped: ${err.message}`);
    }
  }

  const content = {
    id: randomUUID(),
    type: 'topic-lesson',
    title: `Topic ${topic.topicNumber}: ${displayTopicName(topic.topicName)}`,
    topic: {
      grade: topic.grade,
      gradeLabel,
      subject: topic.subject,
      strand: topic.strandName,
      subStrand: displayTopicName(topic.topicName),
      topicNumber: topic.topicNumber,
      topicOrder: topic.topicOrder,
      slug: topic.slug,
    },
    pages: { lesson, quiz, answers },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: lesson.split(/\s+/).length,
      reviewed: false,
      access: topic.topicOrder === 1 ? 'free' : 'paid',
      priceKes: 50,
      questionCount: quizData.questions.length,
      sourceChars: sourceText.length,
      contentSource: 'classroom-study-v9',
      textbookTitles: textbooks.filter((t) => t.kind === 'pupil-book').map((t) => t.title),
      videoScript,
    },
    sources: [
      { id: topic.fileId, grade: topic.grade, subject: topic.subject, excerpt: sourceText.slice(0, 200) },
      ...textbooks
        .filter((t) => t.kind === 'pupil-book')
        .map((t) => ({
          id: t.id,
          grade: t.grade,
          subject: t.subject,
          excerpt: (t.text || '').slice(0, 200),
        })),
    ],
  };

  saveContent(content);

  // Keep Video Hub in sync: one video-script record per topic
  const videoContent = {
    id: randomUUID(),
    type: 'video-script',
    title: `Video: ${displayTopicName(topic.topicName)}`,
    topic: content.topic,
    pages: { lesson: '', quiz: videoScript, answers: '' },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: videoScript.split(/\s+/).length,
      reviewed: false,
      access: 'free',
      priceKes: 0,
      contentSource: 'classroom-study-v9',
      linkedLessonId: content.id,
    },
    sources: content.sources,
  };
  // Replace previous video script for same topic
  let index = [];
  if (existsSync(INDEX_FILE)) index = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
  const sameVideo = (i) =>
    i.type === 'video-script' &&
    i.topic?.grade === videoContent.topic.grade &&
    String(i.topic?.subject || '').toUpperCase() === String(videoContent.topic.subject || '').toUpperCase() &&
    i.topic?.topicNumber === videoContent.topic.topicNumber;
  for (const old of index.filter(sameVideo)) {
    const oldPath = join(CONTENT_DIR, `${old.id}.json`);
    if (existsSync(oldPath) && old.id !== videoContent.id) {
      try {
        writeFileSync(oldPath, '');
      } catch {
        /* ignore */
      }
    }
  }
  index = index.filter((i) => i.id !== videoContent.id && !sameVideo(i));
  writeFileSync(join(CONTENT_DIR, `${videoContent.id}.json`), JSON.stringify(videoContent, null, 2));
  index.unshift({
    ...videoContent,
    pages: { lesson: '', quiz: videoScript.slice(0, 200) + '…', answers: '' },
  });
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));

  console.log(
    `  ✓ Saved (${content.metadata.wordCount} words, ${content.metadata.questionCount} questions, classroom-study + video)`,
  );
}

const args = parseArgs(process.argv);
if (!existsSync(INDEX_PATH)) {
  console.error('Run: npm run content:index');
  process.exit(1);
}

const curriculumIndex = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
let manifest = loadManifest();
if (args.reset) {
  manifest = { version: 3, completed: [] };
  saveManifest(manifest);
}

let grades = curriculumIndex.grades;
if (args.grade) grades = grades.filter((g) => g.grade === args.grade);
if (!args.all && !args.grade) {
  console.error('Use --grade grade-4 or --all');
  process.exit(1);
}

for (const gradeEntry of grades) {
  console.log(`\n=== ${gradeEntry.label} ===`);
  const subjects = Object.values(gradeEntry.subjects);
  const filtered = args.subject
    ? subjects.filter((s) => s.subject.toLowerCase().includes(args.subject.toLowerCase()))
    : subjects;

  for (const subj of filtered) {
    console.log(`\n-- ${subj.subject} (${subj.topics.length} topics) --`);
    for (const topic of subj.topics) {
      // Skip OCR-bleed topic titles that glue several sub-strands together
      if (/\d+\.\d+.*\d+\.\d+/.test(topic.topicName) || /Total Number of Les/i.test(topic.topicName)) {
        console.log(`  skip (garbled title): ${topic.topicNumber} ${topic.topicName.slice(0, 60)}`);
        continue;
      }
      const key = topicKey({ ...topic, grade: gradeEntry.grade, subject: subj.subject });
      if (manifest.completed.includes(key)) {
        console.log(`  skip (done): ${topic.topicNumber} ${topic.topicName}`);
        continue;
      }
      try {
        await generateTopic(
          { ...topic, grade: gradeEntry.grade, subject: subj.subject },
          { dryRun: args.dryRun, noLlm: args.noLlm, enrich: args.enrich },
        );
        if (!args.dryRun) {
          manifest.completed.push(key);
          saveManifest(manifest);
        }
        await sleep(args.delayMs);
      } catch (err) {
        console.error(`  ERROR: ${err.message}`);
      }
    }
  }
}

console.log('\nDone.');
