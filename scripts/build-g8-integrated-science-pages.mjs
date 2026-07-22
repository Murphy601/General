#!/usr/bin/env node
/**
 * Build multi-page Grade 8 Integrated Science classroom lessons from uploaded notes.
 *
 * - Facts come from the notes; wording is rewritten into CBC Learn study pages (Strategy 2).
 * - Each topic becomes several study pages for scroll + future paywall locking.
 * - Default: first FREE_PAGE_COUNT pages unlocked; remaining pages locked until payment.
 *
 * Usage:
 *   node scripts/build-g8-integrated-science-pages.mjs
 *   node scripts/build-g8-integrated-science-pages.mjs --free-pages 3
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const NOTES = join(ROOT, 'knowledge-base', 'textbooks', 'grade-8-integrated-science-notes.json');
const CONTENT_DIR = join(ROOT, 'web', 'data', 'content');
const INDEX_FILE = join(CONTENT_DIR, 'index.json');

const FREE_PAGES = (() => {
  const i = process.argv.indexOf('--free-pages');
  return i >= 0 ? Number(process.argv[i + 1]) || 3 : 3;
})();

const TARGET_CHARS_PER_PAGE = 900; // ~ one readable study screen / "page"
const MIN_PAGES = 4;

function cleanLine(s) {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .replace(//g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toBullet(line) {
  const t = cleanLine(line)
    .replace(/^(?:[-•]|\d+[.)]\s*)/, '')
    .trim();
  if (!t) return '';
  // Soft rewrite: keep fact, pupil voice
  let out = t;
  out = out.replace(/^The learner (?:is guided to|should)\s+/i, '');
  out = out.replace(/\blearner(s)?\b/gi, (m) => (m.toLowerCase() === 'learner' ? 'you' : 'you'));
  if (!/^[A-Z0-9]/.test(out)) out = out.charAt(0).toUpperCase() + out.slice(1);
  return `• ${out}`;
}

function isHeading(line) {
  const t = cleanLine(line);
  if (t.length < 3 || t.length > 90) return false;
  if (/GRADE\s*\d+|LESSON NOTES COMPLETE|RATIONALIZED|^For example,?$/i.test(t)) return false;
  if (/^(STRAND|Strand)\b/i.test(t)) return true;
  if (/^\d+\.\d+\b/.test(t)) return true;
  if (/^(Meaning of|DIFFUSION|OSMOSIS|ELEMENTS AND|Physical and|Chemical|Transformation|Pressure|The Cell|Reproduction|Movement of)/i.test(t)) return true;
  if (t === t.toUpperCase() && /[A-Z]/.test(t) && t.split(/\s+/).length <= 8 && !/COMPLETE/.test(t)) return true;
  return false;
}

/**
 * Split topic paragraphs into study pages with Teach / Examples / Practice structure.
 */
function buildStudyPages(topic) {
  const paras = (topic.paragraphs || []).map(cleanLine).filter(Boolean);
  // Remove duplicate consecutive lines
  const dedup = [];
  for (const p of paras) {
    if (/GRADE\s*\d+|RATIONALIZED|LESSON NOTES COMPLETE/i.test(p)) continue;
    if (/^STRAND\s*\d+/i.test(p) && /MIXTURES|LIVING|FORCE/i.test(p)) {
      // keep strand context as a short heading line only once later
    }
    if (dedup.length && dedup[dedup.length - 1] === p) continue;
    dedup.push(p);
  }

  // Chunk into raw content blocks first
  const chunks = [];
  let buf = [];
  let chars = 0;
  const flush = () => {
    if (!buf.length) return;
    chunks.push(buf);
    buf = [];
    chars = 0;
  };
  for (const p of dedup) {
    if (isHeading(p) && chars > TARGET_CHARS_PER_PAGE * 0.55) flush();
    buf.push(p);
    chars += p.length + 1;
    if (chars >= TARGET_CHARS_PER_PAGE) flush();
  }
  flush();

  while (chunks.length < MIN_PAGES && chunks.length > 0) {
    // Split largest chunk
    let maxI = 0;
    for (let i = 1; i < chunks.length; i += 1) {
      if (chunks[i].length > chunks[maxI].length) maxI = i;
    }
    const big = chunks[maxI];
    if (big.length < 6) break;
    const mid = Math.ceil(big.length / 2);
    chunks.splice(maxI, 1, big.slice(0, mid), big.slice(mid));
  }

  const pages = chunks.map((chunk, idx) => {
    const pageNumber = idx + 1;
    const title = pageTitleFor(topic, pageNumber, chunk);
    const bullets = chunk.map(toBullet).filter(Boolean);
    // Ensure classroom rhythm on each page
    const body = [
      `PAGE ${pageNumber}: ${title}`.toUpperCase(),
      '',
      '▸ Learn',
      '',
      ...bullets.slice(0, Math.max(8, Math.ceil(bullets.length * 0.7))),
      '',
      '▸ Worked / model points',
      '',
      ...pickModels(chunk, topic).map((x) => `• ${x}`),
      '',
      '▸ Try this',
      '',
      ...tryThisFor(topic, pageNumber).map((x) => `• ${x}`),
      '',
      pageNumber < chunks.length
        ? `• Continue to page ${pageNumber + 1} to keep learning this topic.`
        : '• Finished study pages — open the Revision Quiz next.',
    ].join('\n');

    return {
      pageNumber,
      title,
      body,
      free: pageNumber <= FREE_PAGES,
    };
  });

  return pages;
}

function pageTitleFor(topic, pageNumber, chunk) {
  const head = chunk.find(
    (p) =>
      isHeading(p) &&
      !/^STRAND/i.test(p) &&
      !/GRADE\s+\d+|LESSON NOTES|RATIONALIZED/i.test(p),
  );
  if (head && head.length < 70) return cleanLine(head).replace(/^\d+\.\d+\s*-?\s*/, '');
  const defaults = [
    'Key ideas',
    'Examples and symbols',
    'Processes and changes',
    'Applications in Kenya',
    'Practice and revision',
    'Extra practice',
    'Summary boost',
    'Mastery check',
  ];
  return defaults[(pageNumber - 1) % defaults.length];
}

function pickModels(chunk, topic) {
  const models = [];
  const joined = chunk.join(' ');
  // Prefer concrete sentences with examples / numbers / because
  for (const p of chunk) {
    if (/for example|e\.g\.|such as|therefore|=|→|cm|m\b|N\b|atom|cell|energy|pressure|fire/i.test(p) && p.length > 40) {
      models.push(p.length > 160 ? `${p.slice(0, 157)}...` : p);
    }
    if (models.length >= 4) break;
  }
  if (!models.length) {
    models.push(`Re-read the Learn bullets and explain ${topic.topicName} in your own words.`);
    models.push(`Give one Kenyan home/school example of ${topic.topicName}.`);
  }
  while (models.length < 3) {
    models.push(`Link one fact above to daily life in Kenya (${topic.topicName}).`);
  }
  return models.slice(0, 4);
}

function tryThisFor(topic, pageNumber) {
  const name = topic.topicName;
  return [
    `Write 5 bullet points summarising this page on ${name}.`,
    `Create 1 short question a classmate could answer from this page.`,
    `Say aloud (30 seconds): the most important idea on page ${pageNumber}.`,
  ];
}

function buildQuiz(topic, pages) {
  const facts = pages
    .flatMap((p) => p.body.split('\n'))
    .map((l) => l.replace(/^•\s*/, '').trim())
    .filter((l) => l.length > 35 && l.length < 140 && !/^PAGE |^▸|Continue to page|Finished study/i.test(l))
    .slice(0, 20);

  const questions = [];
  const answers = [];
  for (let i = 0; i < 10; i += 1) {
    const fact = facts[i % Math.max(facts.length, 1)] || `${topic.topicName} is studied in Integrated Science.`;
    questions.push({
      number: i + 1,
      type: 'multiple-choice',
      question: `Which statement is true about ${topic.topicName}?`,
      options: [
        `A. ${fact}`,
        `B. ${topic.topicName} has no use in real life.`,
        `C. We should skip examples and only memorise the title.`,
        `D. Science facts never need practice.`,
      ],
    });
    answers.push({ number: i + 1, answer: 'A', explanation: fact });
  }
  for (let i = 0; i < 5; i += 1) {
    const n = 11 + i;
    questions.push({
      number: n,
      type: 'short-answer',
      question:
        i === 0
          ? `Explain ${topic.topicName} using one Kenyan example.`
          : i === 1
            ? `List three key points from the study pages on ${topic.topicName}.`
            : `Write one exam-style question on ${topic.topicName} and answer it.`,
    });
    answers.push({
      number: n,
      answer: 'Any correct answer using ideas from the free/paid study pages.',
      explanation: 'Mark against the study pages.',
    });
  }

  const qLines = [`REVISION QUIZ: ${topic.topicName.toUpperCase()}`, '', '• Use your study pages. Show working where needed.', ''];
  const aLines = [`ANSWERS: ${topic.topicName.toUpperCase()}`, ''];
  for (const q of questions) {
    qLines.push(`${q.number}. ${q.question}`);
    (q.options || []).forEach((o) => qLines.push(`   ${o}`));
    qLines.push('');
  }
  for (const a of answers) {
    aLines.push(`${a.number}. ${a.answer}`);
    if (a.explanation) aLines.push(`   • ${a.explanation}`);
    aLines.push('');
  }
  return { questions, quiz: qLines.join('\n'), answers: aLines.join('\n') };
}

function buildVideoScript(topic, pages) {
  const lines = [
    `VIDEO SCRIPT: ${topic.topicName.toUpperCase()}`,
    `Grade 8 · Integrated Science · ${pages.length} study pages`,
    '',
    '[0:00] Hook — “Today we study this topic page by page.”',
    `[0:20] Teach page 1: ${pages[0]?.title || topic.topicName}`,
    '[2:00] Worked points on board',
    '[3:30] Pause — Try this',
    `[4:30] Preview locked pages (${FREE_PAGES + 1}+) — unlock to continue`,
    '[5:00] CTA — Revision Quiz',
    '',
    '— CBC Learn · aligned to multi-page lesson + revision',
  ];
  return lines.join('\n');
}

function loadIndex() {
  if (!existsSync(INDEX_FILE)) return [];
  return JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
}

function saveLesson(content) {
  mkdirSync(CONTENT_DIR, { recursive: true });
  let index = loadIndex();
  const sameTopic = (i) =>
    i.type === 'topic-lesson' &&
    i.topic?.grade === content.topic.grade &&
    String(i.topic?.subject || '').toUpperCase() === String(content.topic.subject || '').toUpperCase() &&
    i.topic?.topicNumber === content.topic.topicNumber;

  for (const old of index.filter(sameTopic)) {
    const p = join(CONTENT_DIR, `${old.id}.json`);
    if (existsSync(p) && old.id !== content.id) {
      try {
        writeFileSync(p, '');
      } catch {
        /* ignore */
      }
    }
  }
  index = index.filter((i) => i.id !== content.id && !sameTopic(i));
  writeFileSync(join(CONTENT_DIR, `${content.id}.json`), JSON.stringify(content, null, 2));
  index.unshift({
    ...content,
    pages: {
      ...content.pages,
      lesson: (content.pages.lesson || '').slice(0, 220) + '…',
      quiz: '',
      answers: '',
      studyPages: (content.pages.studyPages || []).map((p) => ({
        pageNumber: p.pageNumber,
        title: p.title,
        free: p.free,
        body: '',
      })),
    },
  });
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

function saveVideo(video) {
  let index = loadIndex();
  const same = (i) =>
    i.type === 'video-script' &&
    i.topic?.grade === video.topic.grade &&
    String(i.topic?.subject || '').toUpperCase() === String(video.topic.subject || '').toUpperCase() &&
    i.topic?.topicNumber === video.topic.topicNumber;
  index = index.filter((i) => i.id !== video.id && !same(i));
  writeFileSync(join(CONTENT_DIR, `${video.id}.json`), JSON.stringify(video, null, 2));
  index.unshift({
    ...video,
    pages: { lesson: '', quiz: (video.pages.quiz || '').slice(0, 200) + '…', answers: '' },
  });
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

if (!existsSync(NOTES)) {
  console.error('Missing notes JSON. Expected:', NOTES);
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(NOTES, 'utf8'));
console.log(`Building multi-page lessons for ${catalog.subject} (${catalog.topics.length} topics), freePages=${FREE_PAGES}`);

for (const topic of catalog.topics) {
  const studyPages = buildStudyPages(topic);
  const quizData = buildQuiz(topic, studyPages);
  const freeBodies = studyPages
    .filter((p) => p.free)
    .map((p) => p.body)
    .join('\n\n────────────────────────\n\n');
  const lessonPreview = [
    `LESSON: ${topic.topicName.toUpperCase()}`,
    '',
    `Grade: Grade 8`,
    `Subject: INTEGRATED SCIENCE`,
    `Strand: ${topic.strandName}`,
    `Topic ${topic.topicNumber}: ${topic.topicName}`,
    '',
    `• Multi-page classroom study (${studyPages.length} pages)`,
    `• Pages 1–${FREE_PAGES} free preview · later pages unlock with payment`,
    `• Format: Learn → Worked/model points → Try this`,
    '',
    freeBodies,
  ].join('\n');

  const slug = `${String(topic.topicNumber).replace(/\./g, '-')}-${topic.topicName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)}`;

  const id = randomUUID();
  const content = {
    id,
    type: 'topic-lesson',
    title: `Topic ${topic.topicNumber}: ${topic.topicName}`,
    topic: {
      grade: 'grade-8',
      gradeLabel: 'Grade 8',
      subject: 'INTEGRATED SCIENCE',
      strand: topic.strandName,
      subStrand: topic.topicName,
      topicNumber: topic.topicNumber,
      topicOrder: Number(String(topic.topicNumber).split('.')[0]) * 10 + Number(String(topic.topicNumber).split('.')[1] || 0),
      slug,
    },
    pages: {
      lesson: lessonPreview,
      quiz: quizData.quiz,
      answers: quizData.answers,
      studyPages,
      freePageCount: FREE_PAGES,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: studyPages.reduce((n, p) => n + p.body.split(/\s+/).length, 0),
      reviewed: false,
      access: 'paid',
      priceKes: 50,
      questionCount: quizData.questions.length,
      contentSource: 'g8-is-notes-multipage',
      sourceChars: topic.chars,
      freePageCount: FREE_PAGES,
      totalStudyPages: studyPages.length,
      textbookTitles: ['Grade 8 Rationalized Integrated Science Lesson Notes'],
    },
    sources: [
      {
        id: 'g8-is-notes',
        grade: 'grade-8',
        subject: 'INTEGRATED SCIENCE',
        excerpt: (topic.paragraphs || []).slice(0, 3).join(' ').slice(0, 220),
      },
    ],
  };

  saveLesson(content);

  const videoScript = buildVideoScript(topic, studyPages);
  saveVideo({
    id: randomUUID(),
    type: 'video-script',
    title: `Video: ${topic.topicName}`,
    topic: content.topic,
    pages: { lesson: '', quiz: videoScript, answers: '' },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: videoScript.split(/\s+/).length,
      reviewed: false,
      access: 'free',
      priceKes: 0,
      contentSource: 'g8-is-notes-multipage',
      linkedLessonId: content.id,
    },
    sources: content.sources,
  });

  console.log(
    `  ✓ ${topic.topicNumber} ${topic.topicName}: ${studyPages.length} pages (${studyPages.filter((p) => p.free).length} free / ${studyPages.filter((p) => !p.free).length} locked)`,
  );
}

console.log('\nDone. Open /learn/grade-8/integrated-science');
