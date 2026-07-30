/**
 * Match textbook / pupil-book / programme text to curriculum topics
 * and build thorough learner-facing lessons (with images when available).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLessonFromKicd, buildQuizFromKicd } from './lesson-from-kicd.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEXTBOOK_INDEX = join(__dirname, '..', 'knowledge-base', 'textbooks', 'textbook-index.json');
const TEXT_DIR = join(__dirname, '..', 'knowledge-base', 'textbooks', 'text');

let cache = null;

function normalize(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function subjectKey(subject) {
  const n = normalize(subject);
  if (n.includes('ENGLISH')) return 'english';
  if (n.includes('KISWAHILI') || n.includes('SWAHILI')) return 'kiswahili';
  if (n.includes('MATH')) return 'mathematics';
  if (n.includes('SCIENCE') || n.includes('TECHNOLOGY')) return 'science-and-technology';
  if (n.includes('SOCIAL')) return 'social-studies';
  if (n.includes('AGRICULT')) return 'agriculture';
  if (n.includes('CHRISTIAN') || n === 'CRE') return 'cre';
  if (n.includes('ARABIC')) return 'arabic';
  return n.toLowerCase();
}

function loadTextbookIndex() {
  if (cache) return cache;
  if (!existsSync(TEXTBOOK_INDEX)) {
    cache = { items: [] };
    return cache;
  }
  cache = JSON.parse(readFileSync(TEXTBOOK_INDEX, 'utf8'));
  return cache;
}

function slugify(s) {
  return String(s || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function loadFullRecord(item) {
  if (item.pagesFile) {
    const fullPath = join(TEXT_DIR, item.pagesFile);
    if (existsSync(fullPath)) return JSON.parse(readFileSync(fullPath, 'utf8'));
  }
  const path = join(TEXT_DIR, item.grade, item.subject, `${slugify(item.title)}.json`);
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
  return { text: item.text || '', pages: [] };
}

const STOP = new Set([
  'grade', 'prog', 'programme', 'program', 'english', 'maths', 'mathematics', 'science',
  'kiswahili', 'social', 'studies', 'the', 'and', 'for', 'with', 'from', 'that', 'this',
  'classes', 'class', 'word', 'reading', 'writing', 'listening', 'speaking', 'use',
  'pupil', 'book', 'activities', 'activity', 'lesson', 'week', 'term',
]);

function keywords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

function scoreMatch(item, topic) {
  const topicName = String(topic.topicName || '');
  const topicBlob = normalize(`${topicName} ${topic.strandName || ''} ${topic.topicNumber || ''}`);
  const title = String(item.title || '').replace(/[_]+/g, ' ');
  const itemBlob = normalize(`${title} ${(item.topicHints || []).join(' ')} ${(item.text || '').slice(0, 1200)}`);
  let score = 0;

  for (const w of keywords(topicName)) {
    if (itemBlob.includes(normalize(w))) score += 4;
  }
  for (const w of keywords(title)) {
    if (topicBlob.includes(normalize(w))) score += 5;
  }
  for (const hint of item.topicHints || []) {
    if (topicBlob.includes(normalize(hint))) score += 6;
  }

  if (item.kind === 'pupil-book') score += 8;

  if (/verb aspect|perfect aspect|tense/i.test(topicName)) {
    if (/present continuous/i.test(title)) score += 40;
    if (/past continuous/i.test(title)) score += 40;
  }

  const phrases = [
    ['present continuous', /present continuous|continuous tense/i],
    ['past continuous', /past continuous/i],
    ['full stops', /full stop|capital letter|punctuation/i],
    ['pronounce', /pronounc|sounds|vocabulary/i],
    ['counting', /counting|count forward|count backward/i],
    ['number', /number names|whole numbers|numbers using objects/i],
    ['addition', /addition|add\b/i],
    ['subtraction', /subtraction|subtract/i],
    ['place value', /tens and ones|place value/i],
    ['pattern', /patterns?/i],
    ['shape', /shapes?|geometry/i],
    ['measurement', /measurement|length|mass|capacity/i],
    ['time', /telling time|\btime\b/i],
    ['money', /\bmoney\b|shilling/i],
    ['position', /\bposition\b|ordinal/i],
    ['sorting', /sorting|grouping/i],
    ['matching', /matching|pairing/i],
    ['obedience', /obedience/i],
    ['honesty', /honesty|truthfulness/i],
    ['float', /float|sink/i],
  ];
  for (const [label, re] of phrases) {
    const inTitle = re.test(title) || re.test((item.text || '').slice(0, 400)) || (item.topicHints || []).some((h) => re.test(h));
    const inTopic = re.test(topicName) || re.test(topic.strandName || '');
    if (inTitle && inTopic) score += 14;
    else if (inTitle && topicBlob.includes(normalize(label.split(' ')[0]))) score += 6;
  }

  return score;
}

function scorePage(page, topic) {
  const text = String(page.text || '');
  const blob = normalize(`${text} ${(page.hints || []).join(' ')}`);
  const topicName = String(topic.topicName || '');
  let score = 0;

  // Deprioritize table-of-contents / front-matter pages
  const dotLeaders = (text.match(/\.{4,}/g) || []).length;
  if (dotLeaders >= 2) return -50;
  if (/contents|foreword|preface|acknowledgement/i.test(text.slice(0, 250))) return -50;

  for (const w of keywords(topicName)) {
    if (blob.includes(normalize(w))) score += 5;
  }
  for (const w of keywords(topic.strandName || '')) {
    if (blob.includes(normalize(w))) score += 2;
  }
  for (const hint of page.hints || []) {
    if (normalize(topicName).includes(normalize(hint)) || normalize(hint).includes(normalize(topicName).slice(0, 8))) {
      score += 8;
    }
  }
  if (/work to do/i.test(text)) score += 12;
  if (/\bactivity\b/i.test(text)) score += 6;
  if (/week\s+\d+\s+lesson\s+\d+/i.test(text)) score += 10;
  if (text.length > 80 && text.length < 2200) score += 3;
  return score;
}

export function findTextbookSources(topic, { minScore = 5, limit = 3 } = {}) {
  const index = loadTextbookIndex();
  const grade = topic.grade;
  const subject = subjectKey(topic.subject);

  const candidates = (index.items || []).filter((item) => {
    if (item.grade !== grade) return false;
    if (item.subjectAliases?.some((a) => subjectKey(a) === subject)) return true;
    return (
      subjectKey(item.subject) === subject ||
      subjectKey(item.subject).includes(subject) ||
      subject.includes(subjectKey(item.subject))
    );
  });

  return candidates
    .map((item) => ({ item, score: scoreMatch(item, topic) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => {
      const full = loadFullRecord(x.item);
      const pages = full.pages || [];
      const matchedPages = pages
        .map((p) => ({ ...p, score: scorePage(p, topic) }))
        .filter((p) => p.score >= 8)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      return {
        ...x.item,
        text: full.text || x.item.text || '',
        pages: matchedPages,
        score: x.score,
        kind: x.item.kind || 'programme',
      };
    });
}

/** Clean radio / epub programme scripts into readable learner prose. */
export function cleanTeaching(text) {
  return String(text || '')
    .replace(/Remodal[\s\S]*?(?:Deny|OK)\s*/gi, ' ')
    .replace(/This page needs permission to play audio[\s\S]*?(?:Deny|OK)\s*/gi, ' ')
    .replace(/Responsive, lightweight, fast[\s\S]{0,400}?tracking\.\s*/gi, ' ')
    .replace(/[^\w\s]{0,3}\s*to allow audio playback\s*/gi, ' ')
    .replace(/\b(OK|Deny)\b/g, ' ')
    .replace(/#?\/?\*?Music\*?\*?#?/gi, ' ')
    .replace(/\*Music\*/gi, ' ')
    .replace(/Sfx:\s*[a-z0-9 ]+/gi, ' ')
    .replace(/\bx2\b/gi, ' ')
    .replace(/\bgong\b/gi, ' ')
    .replace(/Your radio teacher is[^.]*\./gi, ' ')
    .replace(/The radio teacher is[^.]*\./gi, ' ')
    .replace(/Welcome to the (?:programme|program|lesson)\.?/gi, ' ')
    .replace(/Hello(?:,)?(?: grade(?:\s+\w+)?)? learner[^.?!]*[.?!]/gi, ' ')
    .replace(/That was .+?(?:programme|program|lesson)[^.]*\./gi, ' ')
    .replace(/Till next time[^.]*\./gi, ' ')
    .replace(/It was produced by[^.]*\./gi, ' ')
    .replace(/The program was written by[^.]*\./gi, ' ')
    .replace(/recorded for the Kenya Institute of Curriculum Development[^.]*\./gi, ' ')
    .replace(/Educational media directorate[^.]*\./gi, ' ')
    .replace(/KAKUNGI's Project[\s\S]*$/gi, ' ')
    .replace(/Start Reading Cover Start of Content[\s\S]*$/gi, ' ')
    .replace(/Page\s+\d+\s+of\s+\d+/gi, ' ')
    .replace(/^\d+\s+/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}

function splitParagraphs(text) {
  return cleanTeaching(text)
    .split(/\n\n+/)
    .map((p) => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 40)
    .filter((p) => !/copyright|all rights reserved|isbn/i.test(p));
}

function pupilBookBlocks(sources) {
  const blocks = [];
  for (const src of sources.filter((s) => s.kind === 'pupil-book')) {
    for (const page of src.pages || []) {
      if (page.image) {
        blocks.push({
          type: 'image',
          src: page.image,
          alt: `${src.title} — page ${page.page}`,
        });
      }
      const paras = splitParagraphs(page.text).slice(0, 8);
      if (paras.length) {
        blocks.push({
          type: 'page',
          title: `From your pupil's book (page ${page.page})`,
          paragraphs: paras,
        });
      }
    }
  }
  return blocks;
}

export function buildLessonFromTextbook(topic, textbookSources, designText) {
  const sources = textbookSources || [];
  const pupilBlocks = pupilBookBlocks(sources);
  const programmeSources = sources.filter((s) => s.kind !== 'pupil-book');
  const teachingParas = splitParagraphs(programmeSources.map((s) => s.text).join('\n\n')).slice(0, 12);
  const hasPupil = pupilBlocks.length > 0;
  const hasProgramme = teachingParas.length > 0;

  // If we only have weak programme text, still produce a strong learner lesson from design + examples
  if (!hasPupil && !hasProgramme) {
    return buildLessonFromKicd({ ...topic, rawText: designText || topic.rawText });
  }

  const isKis = /kiswahili/i.test(topic.subject || '');
  const lines = [];
  lines.push(`LESSON: ${String(topic.topicName).toUpperCase()}`);
  lines.push('');
  lines.push(`Grade: ${topic.gradeLabel || topic.grade}`);
  lines.push(`Subject: ${topic.subject}`);
  if (topic.strandName) lines.push(`Strand: ${topic.strandName}`);
  lines.push(`Topic ${topic.topicNumber}: ${topic.topicName}`);
  lines.push('');

  lines.push(isKis ? 'SEHEMU 1: KARIBU' : 'SECTION 1: WELCOME');
  lines.push('');
  lines.push(
    isKis
      ? `Habari! Leo tutajifunza kuhusu ${topic.topicName}. Soma, angalia picha, fanya mazoezi, kisha jaribu jaribio la marekebisho.`
      : `Hello learner! Today we will learn about ${topic.topicName}. Read, look at the pictures, practise, then try the revision quiz.`,
  );
  lines.push('');

  if (hasPupil) {
    lines.push(isKis ? 'SEHEMU 2: SOMA NA ANGALIA' : 'SECTION 2: LOOK AND LEARN');
    lines.push('');
    for (const block of pupilBlocks) {
      if (block.type === 'image') {
        lines.push(`[[image:${block.src}|${block.alt}]]`);
        lines.push('');
      } else if (block.type === 'page') {
        lines.push(block.title);
        lines.push('');
        for (const p of block.paragraphs) {
          lines.push(p);
          lines.push('');
        }
      }
    }
  }

  if (hasProgramme) {
    lines.push(isKis ? `SEHEMU ${hasPupil ? '3' : '2'}: SOMO` : `SECTION ${hasPupil ? '3' : '2'}: LEARN`);
    lines.push('');
    for (const p of teachingParas) {
      lines.push(p);
      lines.push('');
    }
  }

  const practiceSection = hasPupil ? (hasProgramme ? 4 : 3) : 3;
  lines.push(isKis ? `SEHEMU ${practiceSection}: JARIBU HIVI` : `SECTION ${practiceSection}: TRY THIS`);
  lines.push('');
  lines.push('1. Look again at the examples or pictures above.');
  lines.push(`2. Tell a parent or friend what ${topic.topicName} means, using your own words.`);
  lines.push('3. Copy one example into your exercise book and change it to fit your school or home.');
  lines.push('4. Underline three new words and find out what they mean.');
  lines.push('');

  lines.push(
    isKis
      ? `SEHEMU ${practiceSection + 1}: KAZI YA KUFANYA (MAZOEZI / MAREKEBISHO)`
      : `SECTION ${practiceSection + 1}: WORK TO DO (PRACTICE & REVISION)`,
  );
  lines.push('');
  lines.push(`1. Write five sentences about ${topic.topicName}.`);
  lines.push('2. Complete any “Work to do” items shown in the pupil book pages above.');
  lines.push('3. Create three of your own practice questions on this topic.');
  lines.push('4. Answer the Revision Quiz. Check Answers only after finishing.');
  lines.push('');

  lines.push(isKis ? `SEHEMU ${practiceSection + 2}: KUMBUKA` : `SECTION ${practiceSection + 2}: REMEMBER`);
  lines.push('');
  lines.push(`1. Topic: ${topic.topicName}`);
  lines.push(`2. Subject: ${topic.subject}`);
  if (sources.length) lines.push(`3. Learning materials: ${sources.map((s) => s.title).join('; ')}`);
  lines.push(
    isKis
      ? '4. Fanya jaribio la marekebisho sasa.'
      : '4. Revise with the quiz now.',
  );
  lines.push('');
  lines.push('— CBC Learn · Learner lesson');

  return lines.join('\n');
}

export function buildQuizFromTextbook(topic, textbookSources, designText) {
  const pageSentences = (textbookSources || [])
    .filter((s) => s.kind === 'pupil-book')
    .flatMap((s) => (s.pages || []).map((p) => p.text))
    .join(' ');
  const programmeText = (textbookSources || [])
    .filter((s) => s.kind !== 'pupil-book')
    .map((s) => s.text)
    .join(' ');
  const teaching = cleanTeaching([pageSentences, programmeText].filter(Boolean).join('\n'));
  const sentences = teaching
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 35 && s.length < 160)
    .filter((s) => !/remodal|permission to play|radio teacher|produced by|acknowledgement|foreword|preface|isbn|copyright/i.test(s))
    .filter((s) => !/^---\s*page/i.test(s));

  if (sentences.length < 4) {
    return buildQuizFromKicd({ ...topic, rawText: designText || topic.rawText || teaching });
  }

  const questions = [];
  const answers = [];

  for (let i = 0; i < 10; i += 1) {
    const num = i + 1;
    const correct = sentences[i % sentences.length];
    const wrongA = sentences[(i + 3) % sentences.length] || `Ignore ${topic.topicName}`;
    const wrongB = sentences[(i + 5) % sentences.length] || `${topic.topicName} is not useful`;
    questions.push({
      number: num,
      type: 'multiple-choice',
      question: `From today's lesson on ${topic.topicName}, which idea is correct?`,
      options: [
        `A. ${correct}`,
        `B. ${wrongA}`,
        `C. ${wrongB}`,
        `D. We should skip practice for this topic.`,
      ],
    });
    answers.push({ number: num, answer: 'A', explanation: correct });
  }

  const short = [
    `Explain ${topic.topicName} using one example from the lesson.`,
    'Write two new words you learned and their meanings.',
    'Describe one activity you can do at home to practise this topic.',
    'What picture or example helped you understand best? Why?',
    'Write three revision questions of your own for a classmate.',
  ];
  for (let i = 0; i < 5; i += 1) {
    const num = 11 + i;
    questions.push({ number: num, type: 'short-answer', question: short[i] });
    answers.push({
      number: num,
      answer: 'Answers will vary; must use ideas from the lesson examples or pupil book pages.',
      explanation: 'Accept any relevant response grounded in the lesson.',
    });
  }

  return { questions, answers };
}
