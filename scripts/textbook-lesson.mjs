/**
 * Match textbook/programme text to curriculum topics and build thorough lessons.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

function loadFullText(item) {
  const path = join(TEXT_DIR, item.grade, item.subject, `${slugify(item.title)}.json`);
  // try index path pattern
  const candidates = [
    path,
    join(TEXT_DIR, item.grade, item.subject, item.sourceFile?.split(/[/\\]/).pop()?.replace(/\.(epub|pdf)$/i, '') + '.json'),
  ];
  for (const p of candidates) {
    if (p && existsSync(p)) {
      const full = JSON.parse(readFileSync(p, 'utf8'));
      return full.text || '';
    }
  }
  // scan directory
  const dir = join(TEXT_DIR, item.grade, item.subject);
  if (!existsSync(dir)) return item.text || '';
  // fallback: use preview from index only
  return item.text || '';
}

function slugify(s) {
  return String(s || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

const STOP = new Set([
  'grade', 'prog', 'programme', 'program', 'english', 'maths', 'mathematics', 'science',
  'kiswahili', 'social', 'studies', 'the', 'and', 'for', 'with', 'from', 'that', 'this',
  'classes', 'class', 'word', 'reading', 'writing', 'listening', 'speaking', 'use',
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

  // Prefer continuous-tense programmes for verb-aspect topics
  if (/verb aspect|perfect aspect|tense/i.test(topicName)) {
    if (/present continuous/i.test(title)) score += 40;
    if (/past continuous/i.test(title)) score += 40;
    if (/constructed forms of verbs/i.test(title)) score += 8;
    if (/perfect/i.test(title + (item.text || '').slice(0, 300))) score += 10;
  }

  // Strong phrase matches for common English grammar programmes
  const phrases = [
    ['present continuous', /present continuous|continuous tense/i],
    ['past continuous', /past continuous/i],
    ['full stops', /full stop|capital letter|punctuation/i],
    ['pronounce', /pronounc|sounds|vocabulary/i],
    ['verbs', /constructed forms of verbs|verb forms/i],
    ['traditional culture', /traditional culture|culture in the county/i],
    ['the school', /\bthe school\b|school\b/i],
    ['industries', /industr/i],
    ['trade', /\btrade\b/i],
    ['citizenship', /citizenship|good citizen/i],
    ['peace', /\bpeace\b/i],
    ['democracy', /democracy/i],
    ['community leaders', /community leader|leadership/i],
    ['child', /child rights|child abuse/i],
    ['float', /float|sink/i],
    ['matter', /properties of matter|matter/i],
    ['force', /force and its effect|\bforce\b/i],
    ['perimeter', /perimeter/i],
    ['area', /\barea\b/i],
    ['capacity', /capacity/i],
    ['addition', /addition/i],
    ['time', /telling time|\btime\b/i],
    ['cube', /cube|cuboid/i],
    ['meter', /meter|centimeter|length/i],
  ];
  for (const [label, re] of phrases) {
    const inTitle = re.test(title) || re.test((item.text || '').slice(0, 400));
    const inTopic = re.test(topicName);
    if (inTitle && inTopic) score += 12;
    else if (inTitle && topicBlob.includes(normalize(label.split(' ')[0]))) score += 6;
  }

  // Science: floating/sinking programmes belong under matter/force topics
  if (/float|sink/i.test(title) && /matter|force|water/i.test(topicName)) score += 18;

  return score;
}

export function findTextbookSources(topic, { minScore = 5, limit = 3 } = {}) {
  const index = loadTextbookIndex();
  const grade = topic.grade;
  const subject = subjectKey(topic.subject);

  const candidates = (index.items || []).filter((item) => {
    if (item.grade !== grade) return false;
    return subjectKey(item.subject) === subject || subjectKey(item.subject).includes(subject) || subject.includes(subjectKey(item.subject));
  });

  return candidates
    .map((item) => ({ item, score: scoreMatch(item, topic) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => {
      const fullPath = join(TEXT_DIR, x.item.grade, x.item.subject, `${slugify(x.item.title)}.json`);
      let text = x.item.text || '';
      if (existsSync(fullPath)) {
        text = JSON.parse(readFileSync(fullPath, 'utf8')).text || text;
      }
      return { ...x.item, text, score: x.score };
    });
}

function cleanTeaching(text) {
  return String(text || '')
    .replace(/Remodal[\s\S]*?(?:Deny|OK)\s*/gi, ' ')
    .replace(/This page needs permission to play audio[\s\S]*?(?:Deny|OK)\s*/gi, ' ')
    .replace(/Responsive, lightweight, fast[\s\S]{0,400}?tracking\.\s*/gi, ' ')
    .replace(/[^\w\s]{0,3}\s*to allow audio playback\s*/gi, ' ')
    .replace(/\b(OK|Deny)\b/g, ' ')
    .replace(/^\d+\s+/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildLessonFromTextbook(topic, textbookSources, designText) {
  const sources = textbookSources || [];
  const teaching = cleanTeaching(sources.map((s) => s.text).join('\n\n'));
  const hasTeaching = teaching.length > 200;

  const lines = [];
  lines.push(`LESSON: ${String(topic.topicName).toUpperCase()}`);
  lines.push('');
  lines.push(`Grade: ${topic.gradeLabel || topic.grade}`);
  lines.push(`Subject: ${topic.subject}`);
  lines.push(`Strand: ${topic.strandName}`);
  lines.push(`Topic ${topic.topicNumber}: ${topic.topicName}`);
  lines.push('');

  lines.push('SECTION 1: INTRODUCTION');
  lines.push('');
  if (hasTeaching) {
    // Use opening of teaching text
    const intro = teaching.split(/\n\n/).find((p) => p.length > 60) || teaching.slice(0, 500);
    lines.push(intro.slice(0, 800));
  } else {
    lines.push(
      `This lesson is ${topic.topicName} for ${topic.gradeLabel || topic.grade} ${topic.subject}. Study the teaching notes below carefully, then attempt the revision quiz.`,
    );
  }
  lines.push('');

  lines.push('SECTION 2: TEACHING CONTENT');
  lines.push('');
  if (hasTeaching) {
    lines.push(teaching);
  } else {
    lines.push(
      'Teaching content from learner books / KICD programmes for this topic is not yet available in the library. Below is the curriculum guide for teachers and parents while textbook harvest continues.',
    );
    lines.push('');
    if (designText) {
      lines.push(designText.slice(0, 4000));
    }
  }
  lines.push('');

  lines.push('SECTION 3: PRACTICE');
  lines.push('');
  lines.push('1. Re-read the teaching content and underline three new words or ideas.');
  lines.push('2. Explain the main idea of this topic to a parent or classmate in your own words.');
  lines.push('3. Write five sentences using examples from your school or county.');
  lines.push('4. Complete the revision quiz for this topic. Check answers only after finishing.');
  lines.push('');

  if (designText) {
    lines.push('SECTION 4: CURRICULUM ALIGNMENT (KICD)');
    lines.push('');
    lines.push('This lesson is aligned to the official KICD curriculum design for this sub-strand.');
    lines.push('');
    // Keep a shorter design excerpt for alignment, not as the whole lesson
    const outcomes = designText.match(/By the end of the sub[\s\S]{0,1200}?Core Competencies/i);
    if (outcomes) lines.push(outcomes[0].replace(/Core Competencies.*/i, '').trim());
    else lines.push(designText.slice(0, 1500));
    lines.push('');
  }

  lines.push('SECTION 5: SUMMARY');
  lines.push('');
  lines.push(`1. Topic: ${topic.topicName}`);
  lines.push(`2. Subject: ${topic.subject}`);
  if (sources.length) {
    lines.push(`3. Source materials: ${sources.map((s) => s.title).join('; ')}`);
  }
  lines.push('4. Revise using the quiz, then check the answer key.');
  lines.push('');
  lines.push(hasTeaching ? 'Grounded in KICD learning programmes / learner materials and curriculum design.' : 'Grounded in KICD curriculum design. Textbook harvest ongoing.');

  return lines.join('\n');
}

export function buildQuizFromTextbook(topic, textbookSources, designText) {
  const teaching = (textbookSources || []).map((s) => s.text).join(' ');
  const sentences = teaching
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 180 && !/remodal|permission to play audio/i.test(s));

  const questions = [];
  const answers = [];

  for (let i = 0; i < 10; i += 1) {
    const num = i + 1;
    if (sentences[i]) {
      const s = sentences[i];
      const words = s.split(/\s+/);
      const blankAt = Math.min(Math.max(3, Math.floor(words.length / 2)), words.length - 2);
      const answerWord = words[blankAt].replace(/[^a-zA-Z0-9'-]/g, '');
      const stem = [...words];
      stem[blankAt] = '______';
      questions.push({
        number: num,
        type: 'multiple-choice',
        question: `Fill in the blank from the lesson: ${stem.join(' ')}`,
        options: [
          `A. ${answerWord}`,
          'B. Nairobi',
          'C. Yesterday',
          'D. None of these',
        ],
      });
      answers.push({ number: num, answer: 'A', explanation: s });
    } else {
      questions.push({
        number: num,
        type: 'multiple-choice',
        question: `Which topic are you revising?`,
        options: [
          `A. ${topic.topicName}`,
          'B. Unrelated topic',
          'C. Foreign curriculum',
          'D. None of the above',
        ],
      });
      answers.push({ number: num, answer: 'A', explanation: topic.topicName });
    }
  }

  const shorts = [
    `Explain the main idea of ${topic.topicName} in your own words.`,
    `Give two examples from the lesson on ${topic.topicName}.`,
    `How can you use what you learned about ${topic.topicName} at home or school?`,
    `List three key points from this lesson.`,
    `Write one question you still have about ${topic.topicName}.`,
  ];
  for (let i = 0; i < 5; i += 1) {
    const num = 11 + i;
    questions.push({ number: num, type: 'short-answer', question: shorts[i] });
    answers.push({
      number: num,
      answer: sentences[i] || 'Answer using ideas from the teaching content.',
      explanation: 'Award marks for clear, accurate points from the lesson.',
    });
  }

  return { questions, answers };
}
