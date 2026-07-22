#!/usr/bin/env node
/**
 * Build Grade 8 Integrated Science STUDENT study pages from uploaded notes.
 *
 * Teaching style (not teacher-guide dump):
 *   Today’s idea → Learn (pupil voice) → Worked example → Your turn
 *
 * Experiments become “What we see / What it means” for learners.
 * Page locks off by default until publish (--lock).
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

const LOCK_MODE = process.argv.includes('--lock');
const FREE_PAGES = (() => {
  const i = process.argv.indexOf('--free-pages');
  return i >= 0 ? Number(process.argv[i + 1]) || 3 : 3;
})();

const TARGET = 650;
const MAX = 950;

function clean(s) {
  return String(s || '')
    .replace(/[\u00a0]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bcompunds\b/gi, 'compounds')
    .replace(/\bflouride\b/gi, 'fluoride')
    .replace(/\bsort -hand\b/gi, 'shorthand')
    .replace(/\bration\b/gi, 'ratio')
    .replace(/\bgoogles\b/gi, 'goggles')
    .replace(/\blearner\b/gi, 'you')
    .replace(/\blearners\b/gi, 'you')
    .trim();
}

function isNoise(line) {
  const t = clean(line);
  if (!t || t.length < 2) return true;
  if (/^GRADE\s*\d+|LESSON NOTES|RATIONALIZED|^STRAND\s*\d/i.test(t)) return true;
  if (
    /^(Name of element|Chemical symbol|Latin name\.?|Volume|Density|Shape|Ability to flow|Compressibility|State of matter|Mineral element of compound|Examples of food sources|Objective lens magnification|Eyepiece lens magnification|Total magnification\.?)$/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/^\d+$/.test(t)) return true;
  return false;
}

function isHeading(line, topic) {
  const raw = clean(line);
  const t = raw.replace(/:$/, '');
  if (!t || t.length < 4 || t.length > 100) return false;
  if (isNoise(t)) return false;
  if (/^(Requirements|Procedure|Procedures|Caution|Observation|For example)\.?$/i.test(t)) return false;
  if (/^=|^Use it to$|^Therefore, we conclude/i.test(t)) return false;
  if (/^\d+\.\d+\b/.test(t)) return true;
  if (t.toLowerCase() === String(topic.topicName || '').toLowerCase()) return true;
  if (
    /^(Meaning of|Relating common|Application of|Applications of|Importance of|Properties of|Summary of|Pure and Impure|Diffusion and Osmosis|Pressure in|Meaning of pressure|Classes of|Safety measures|Forms of energy|Information on Packaging|Examples of food nutrients|The cell membrane|In plants Osmosis|In animals|Movement of|Reproduction|Transformation of|Physical changes|Chemical changes|Calculating the|Magnification of|Plant cells|Animal cells|Solutes and solvent|Concentration\.?$|DIFFUSION\.?$|OSMOSIS\.?$|The symbols of some elements)/i.test(
      t,
    )
  ) {
    return true;
  }
  // Importance blocks only when labeled with a colon (not table cells "Gold")
  if (/^(Gold|Silver|Iron):$/i.test(raw)) return true;
  if (t === t.toUpperCase() && /[A-Z]/.test(t) && t.split(/\s+/).length >= 2 && t.split(/\s+/).length <= 10) {
    return true;
  }
  if (/:$/.test(raw) && t.length >= 18 && t.length < 80) return true;
  return false;
}

function isLabLabel(line) {
  return /^(Requirements|Procedure|Procedures|Caution|Observation)\s*:?\s*$/i.test(clean(line));
}

function splitSections(topic) {
  const paras = (topic.paragraphs || []).map(clean).filter((p) => !isNoise(p));
  const sections = [];
  let cur = { title: topic.topicName, lines: [] };
  const push = () => {
    if (cur.lines.length) sections.push({ title: cur.title, lines: [...cur.lines] });
  };
  for (const p of paras) {
    if (isHeading(p, topic) && cur.lines.length >= 3) {
      push();
      cur = { title: p.replace(/:$/, ''), lines: [] };
      continue;
    }
    if (isHeading(p, topic) && !cur.lines.length) {
      cur.title = p.replace(/:$/, '');
      continue;
    }
    cur.lines.push(p);
  }
  push();

  // merge tiny tails
  const out = [];
  for (const s of sections) {
    if (out.length && s.lines.join(' ').length < 140) {
      out[out.length - 1].lines.push(...s.lines);
    } else out.push(s);
  }
  return out;
}

function paginate(lines) {
  const pages = [];
  let buf = [];
  let n = 0;
  const flush = () => {
    if (!buf.length) return;
    pages.push(buf);
    buf = [];
    n = 0;
  };
  for (const line of lines) {
    const len = line.length + 1;
    if (buf.length && n + len > MAX) flush();
    buf.push(line);
    n += len;
    if (n >= TARGET) flush();
  }
  flush();
  return pages.length ? pages : [lines];
}

/** Pair element/symbol table fragments into readable rows. */
function normalizePairs(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const a = clean(lines[i]);
    const b = clean(lines[i + 1] || '');
    const c = clean(lines[i + 2] || '');
    const latinish = (x) => /^[A-Za-z][a-z]+$/.test(x);
    const symbolish = (x) => /^[A-Z][a-z]?$/.test(x) && x.length <= 2;
    if (/^[A-Z][a-z]+$/.test(a) && latinish(b) && symbolish(c)) {
      out.push(`${a} (Latin: ${b.charAt(0).toUpperCase()}${b.slice(1)}) is written as ${c}.`);
      i += 2;
      continue;
    }
    if (/^[A-Z][a-z]+$/.test(a) && symbolish(b)) {
      out.push(`${a} is written as ${b}.`);
      i += 1;
      continue;
    }
    if (
      /^(Carbon|Nitrogen|Fluoride|Calcium|Copper|Iron|Magnesium|Phosphorus|Potassium|Sodium chloride)$/i.test(a) &&
      b.length > 10
    ) {
      out.push(`${a} is found in: ${b}`);
      i += 1;
      continue;
    }
    out.push(lines[i]);
  }
  return out;
}

function sentenceCase(s) {
  let t = clean(s);
  if (!t) return '';
  // Light pupil-facing grammar cleanup (keep facts)
  t = t.replace(/\bare can be\b/gi, 'can be');
  t = t.replace(/\bcan be element and compounds\b/gi, 'can be elements or compounds');
  t = t.replace(/\bhas a unique name\b/gi, 'have a unique name');
  t = t.replace(/\bA compound is pure substance\b/gi, 'A compound is a pure substance');
  t = t.replace(/\bcan not\b/gi, 'cannot');
  t = t.replace(/\bthere they are more\b/gi, 'where they are more');
  t = t.replace(/\ba is method\b/gi, 'is a method');
  t = t.replace(/\bbase are x\b/gi, 'base area ×');
  if (!/^[A-Z0-9“"]/.test(t)) t = t.charAt(0).toUpperCase() + t.slice(1);
  return t;
}

function displayTitle(title) {
  let t = clean(title)
    .replace(/\s*\(\d+\/\d+\)\s*$/g, '')
    .replace(/\s*\((?:a|b)\)\s*$/i, '')
    .replace(/\.$/, '')
    .trim();
  // Shorten guide-like long headings for students
  const shorts = [
    [/the symbols of some elements derived from latin names.*/i, 'Symbols from Latin names'],
    [/the symbols of some elements derived from english names.*/i, 'Symbols from English names'],
    [/the following are some of the important mineral elements.*/i, 'Mineral elements for plants'],
    [/experiment to demonstrate osmosis.*/i, 'Osmosis experiment'],
    [/in plants osmosis plays.*/i, 'Osmosis in plants'],
    [/in animals,? osmosis plays.*/i, 'Osmosis in animals'],
    [/application of common elements.*/i, 'Elements in daily life'],
    [/information on packaging labels.*/i, 'Elements on packaging labels'],
    [/relating common elements.*/i, 'Element symbols'],
    [/meaning of atoms.*/i, 'Atoms, elements and compounds'],
  ];
  for (const [rx, nice] of shorts) {
    if (rx.test(t)) return nice;
  }
  return t;
}

/**
 * Rewrite a chunk of note lines into pupil-facing teaching text.
 */
function teachFromNotes(topic, title, lines) {
  const norm = normalizePairs(lines).map(clean).filter(Boolean);
  const learn = [];
  const examples = [];
  let mode = 'teach'; // teach | apparatus | steps | caution
  const apparatus = [];
  const steps = [];
  const cautions = [];

  for (const line of norm) {
    if (isLabLabel(line)) {
      const lab = clean(line).toLowerCase();
      if (lab.startsWith('requirement')) mode = 'apparatus';
      else if (lab.startsWith('procedure')) mode = 'steps';
      else if (lab.startsWith('caution')) mode = 'caution';
      else if (lab.startsWith('observation')) mode = 'teach';
      continue;
    }
    if (mode === 'apparatus') {
      apparatus.push(line.replace(/^[-•]\s*/, ''));
      continue;
    }
    if (mode === 'steps') {
      steps.push(line.replace(/^[-•]\s*/, ''));
      continue;
    }
    if (mode === 'caution') {
      cautions.push(line.replace(/^[-•]\s*/, ''));
      continue;
    }

    if (/^for example[,:]?\s*$/i.test(line)) continue;
    if (/^for example/i.test(line) || /for example[,:]/i.test(line) || /e\.g\./i.test(line)) {
      const ex = sentenceCase(line.replace(/^for example[,:]?\s*/i, ''));
      if (ex.length > 8) examples.push(ex);
      continue;
    }
    learn.push(sentenceCase(line));
  }

  // Convert lab lists into student science (not teacher guide)
  if (apparatus.length || steps.length) {
    learn.push('In class/lab we can show this idea with a simple activity.');
    if (steps.length) {
      learn.push('What you do / what happens:');
      steps.slice(0, 6).forEach((s, i) => learn.push(`${i + 1}. ${sentenceCase(s)}`));
    }
    if (apparatus.length) {
      learn.push(`You may use simple materials such as: ${apparatus.slice(0, 6).join('; ')}.`);
    }
    if (cautions.length) {
      learn.push(`Safety: ${cautions.map(sentenceCase).join(' ')}`);
    }
  } else if (cautions.length) {
    learn.push(`Safety: ${cautions.map(sentenceCase).join(' ')}`);
  }

  // Build pupil paragraphs (not endless raw bullets)
  const body = [];
  body.push(`Today we study: ${clean(title)}.`);
  body.push('');

  // Group learn lines into short teaching blocks
  const facts = learn.filter((l) => l && !/^In class\/lab/i.test(l));
  const lead = facts.slice(0, 2);
  const rest = facts.slice(2);

  if (lead.length) {
    body.push(lead.join(' '));
    body.push('');
  }

  // Keep remaining facts as clear study bullets (student notes style)
  for (const f of rest) {
    if (/^\d+\.\s/.test(f) || /^What you do/i.test(f) || /^You may use/i.test(f) || /^Safety:/i.test(f) || /^In class/i.test(f)) {
      body.push(f);
    } else {
      body.push(`• ${f}`);
    }
  }

  if (examples.length) {
    body.push('');
    body.push('Example from daily life / class:');
    examples.slice(0, 4).forEach((e) => body.push(`• ${e}`));
  }

  return body.join('\n').trim();
}

function pickWorkedExample(topic, title, lines) {
  const text = lines.map(clean).join(' ');
  const out = [];

  // Pressure calculations
  const forceArea = text.match(/Force[^.]{0,40}?(\d+\s*N)[^.]{0,80}?(\d+(?:\.\d+)?\s*m)/i);
  if (/pressure/i.test(topic.topicName + title) && /F\/A|Force\/Area|Pascal/i.test(text)) {
    out.push('Worked example:');
    out.push('• Formula: Pressure = Force ÷ Area (P = F/A).');
    out.push('• Unit: N/m² which is also called Pascal (Pa).');
    if (forceArea) {
      out.push(`• From the notes: force ${forceArea[1]} on area about ${forceArea[2]}.`);
      out.push('• Divide force by area to get pressure. Bigger force or smaller area → higher pressure.');
    } else {
      out.push('• Example idea: same weight on a sharp heel sinks more than on a flat shoe because area is smaller.');
    }
    return out;
  }

  // Magnification
  if (/magnification|eyepiece|objective/i.test(text)) {
    out.push('Worked example:');
    out.push('• Total magnification = eyepiece × objective.');
    out.push('• If eyepiece is ×10 and objective is ×4, total = 10 × 4 = ×40.');
    out.push('• If objective is ×10, total = 10 × 10 = ×100.');
    return out;
  }

  // Chemical symbols / formulas
  if (/symbol|H2O|NaCl|formula/i.test(text)) {
    out.push('Worked example:');
    out.push('• Hydrogen is H, Oxygen is O → water is H₂O (2 hydrogen : 1 oxygen).');
    out.push('• Sodium is Na, Chlorine is Cl → common salt is NaCl.');
    out.push('• First letter of a symbol is capital; second letter (if any) is small (Ca, Cl, Cu).');
    return out;
  }

  // Diffusion / osmosis
  if (/diffusion|osmosis/i.test(text + title)) {
    out.push('Worked example:');
    if (/osmosis/i.test(title + text)) {
      out.push('• Water moves from where it is more (dilute solution) to where it is less (concentrated solution) across a membrane.');
      out.push('• Kenya link: roots take in water from soil partly by osmosis.');
    } else {
      out.push('• Perfume smell spreads across a room: particles move from high to low concentration — that is diffusion.');
      out.push('• Sugar in tea spreads without stirring until the tea tastes even — diffusion in a liquid.');
    }
    return out;
  }

  // Fire classes
  if (/fire|class a|class b/i.test(topic.topicName + title + text)) {
    out.push('Worked example:');
    out.push('• Class A (wood/paper): cool with water.');
    out.push('• Class B (petrol/oil): do NOT use water — smother / correct extinguisher.');
    out.push('• Remember the fire triangle: fuel, heat, oxygen — remove one and fire stops.');
    return out;
  }

  // States of matter / changes
  if (/solid|liquid|gas|physical change|chemical change/i.test(text)) {
    out.push('Worked example:');
    out.push('• Ice → water → steam: change of state (physical) — substance is still water.');
    out.push('• Burning paper: new substances form (chemical change) — you cannot get the paper back.');
    return out;
  }

  // Elements / compounds default teaching model
  if (/element|compound|atom/i.test(topic.topicName + title)) {
    out.push('Worked example:');
    out.push('• Sodium (Na) and chlorine (Cl) are elements.');
    out.push('• When they join chemically they make sodium chloride (NaCl) — a compound (common salt).');
    out.push('• Remember: elements are building blocks; compounds are elements joined chemically.');
    return out;
  }

  // Default: use first strong definition + Kenya apply
  const def = lines.map(clean).find((l) => l.length > 50 && /is |are |means |defined/i.test(l));
  out.push('Worked example:');
  if (def) out.push(`• ${sentenceCase(def)}`);
  out.push(`• Kenya link: connect “${clean(title)}” to one thing at home, school, farm or market.`);
  out.push('• Say the main idea in your own words (20 seconds).');
  return out;
}

function yourTurn(topic, title, pageNumber) {
  return [
    'Your turn:',
    `• Write 5 short bullet notes on “${clean(title)}” without copying whole sentences.`,
    `• Answer: How does this help you understand ${topic.topicName}?`,
    pageNumber % 2 === 0
      ? '• Draw a simple diagram or table for this page and label it.'
      : '• Make one exam-style question from this page and answer it.',
  ];
}

function formatPage(topic, pageNumber, title, lines, total) {
  const nice = displayTitle(title);
  const learn = teachFromNotes(topic, nice, lines);
  const worked = pickWorkedExample(topic, nice, lines);
  const practice = yourTurn(topic, nice, pageNumber);

  const body = [
    `PAGE ${pageNumber}: ${nice}`.toUpperCase(),
    '',
    `Grade 8 · Integrated Science · Topic ${topic.topicNumber}: ${topic.topicName}`,
    '',
    '▸ Today’s idea',
    '',
    `• ${nice} — read, see the example, then do Your turn.`,
    '',
    '▸ Learn',
    '',
    learn,
    '',
    '▸ Worked example',
    '',
    ...worked.filter((l) => l !== 'Worked example:'),
    '',
    '▸ Your turn',
    '',
    ...practice.filter((l) => l !== 'Your turn:'),
    '',
    pageNumber < total
      ? `• Next page → continue the topic (${pageNumber + 1} of ${total}).`
      : '• Finished study pages — now open the Revision Quiz.',
  ].join('\n');

  return {
    pageNumber,
    title: nice,
    body,
    free: !LOCK_MODE || pageNumber <= FREE_PAGES,
  };
}

function buildStudyPages(topic) {
  const sections = splitSections(topic);
  const raw = [];
  for (const section of sections) {
    const chunks = paginate(section.lines);
    chunks.forEach((lines, i) => {
      const title = chunks.length === 1 ? section.title : `${section.title} (${i + 1}/${chunks.length})`;
      raw.push({ title, lines });
    });
  }
  // Ensure denser topics aren't tiny booklets
  while (raw.length < 8) {
    let maxI = 0;
    for (let i = 1; i < raw.length; i += 1) {
      if (raw[i].lines.join(' ').length > raw[maxI].lines.join(' ').length) maxI = i;
    }
    const big = raw[maxI];
    if (big.lines.length < 8) break;
    const mid = Math.ceil(big.lines.length / 2);
    raw.splice(
      maxI,
      1,
      { title: `${big.title.replace(/\s*\(\d+\/\d+\)$/, '')} (a)`, lines: big.lines.slice(0, mid) },
      { title: `${big.title.replace(/\s*\(\d+\/\d+\)$/, '')} (b)`, lines: big.lines.slice(mid) },
    );
  }
  return raw.map((p, idx) => formatPage(topic, idx + 1, p.title, p.lines, raw.length));
}

function buildQuiz(topic, pages) {
  const facts = pages
    .flatMap((p) => p.body.split('\n'))
    .map((l) => l.replace(/^•\s*/, '').trim())
    .filter(
      (l) =>
        l.length > 35 &&
        l.length < 150 &&
        !/^(PAGE |▸|Grade 8|Today we|Your turn|Worked example|Next page|Finished study|Write 5|Answer:|Draw a|Make one|Kenya link|Formula:)/i.test(
          l,
        ),
    );

  const picked = [];
  const step = Math.max(1, Math.floor(facts.length / 12));
  for (let i = 0; i < facts.length && picked.length < 12; i += step) picked.push(facts[i]);

  const questions = [];
  const answers = [];
  for (let i = 0; i < 10; i += 1) {
    const fact = picked[i] || `${topic.topicName} is studied in Grade 8 Integrated Science.`;
    questions.push({
      number: i + 1,
      question: `Which statement correctly matches the study notes on ${topic.topicName}?`,
      options: [
        `A. ${fact}`,
        `B. ${topic.topicName} is not useful in daily life.`,
        `C. Learners should skip examples and only memorise headings.`,
        `D. Science has no definitions or worked examples.`,
      ],
    });
    answers.push({ number: i + 1, answer: 'A', explanation: fact });
  }
  for (let i = 0; i < 5; i += 1) {
    const n = 11 + i;
    const prompts = [
      `Explain ${topic.topicName} in your own words using one Kenyan example.`,
      `List five key points you learned from the study pages on ${topic.topicName}.`,
      `Write one short paragraph summarising the most important idea in ${topic.topicName}.`,
      `Create one exam-style question on ${topic.topicName} and answer it.`,
      `How can knowing ${topic.topicName} help you at home or school?`,
    ];
    questions.push({ number: n, question: prompts[i] });
    answers.push({
      number: n,
      answer: 'Any clear answer based on the study pages.',
      explanation: 'Mark against Learn + Worked example pages.',
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
  return [
    `VIDEO SCRIPT: ${topic.topicName.toUpperCase()}`,
    `Grade 8 · Integrated Science · ${pages.length} student study pages`,
    '',
    '[0:00] Hook — Today we learn this topic like a class lesson: idea → example → your turn.',
    `[0:25] Teach page 1: ${pages[0]?.title || topic.topicName}`,
    '[2:00] Worked example on the board',
    '[3:20] Pause — Your turn',
    `[4:20] Continue pages 2–${Math.min(4, pages.length)}`,
    '[5:40] CTA — Finish pages, then Revision Quiz',
    '',
    '— CBC Learn · student study pages',
  ].join('\n');
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
  console.error('Missing notes JSON:', NOTES);
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(NOTES, 'utf8'));
console.log(
  `Building STUDENT study pages for ${catalog.subject} (${catalog.topics.length} topics)` +
    (LOCK_MODE ? `, LOCK on (freePages=${FREE_PAGES})` : ', all pages UNLOCKED'),
);

for (const topic of catalog.topics) {
  const studyPages = buildStudyPages(topic);
  const quizData = buildQuiz(topic, studyPages);
  const freeCount = LOCK_MODE ? FREE_PAGES : studyPages.length;

  const lessonPreview = [
    `LESSON: ${topic.topicName.toUpperCase()}`,
    '',
    `Grade 8 · INTEGRATED SCIENCE`,
    `Strand: ${topic.strandName}`,
    `Topic ${topic.topicNumber}: ${topic.topicName}`,
    '',
    `• Student study booklet (${studyPages.length} pages)`,
    `• Style: Today’s idea → Learn → Worked example → Your turn`,
    LOCK_MODE
      ? `• Pages 1–${FREE_PAGES} free · later pages locked at publish`
      : '• All pages unlocked for now',
    '',
    studyPages.map((p) => `Page ${p.pageNumber}: ${p.title}`).join('\n'),
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
      topicOrder:
        Number(String(topic.topicNumber).split('.')[0]) * 10 +
        Number(String(topic.topicNumber).split('.')[1] || 0),
      slug,
    },
    pages: {
      lesson: lessonPreview,
      quiz: quizData.quiz,
      answers: quizData.answers,
      studyPages,
      freePageCount: freeCount,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: studyPages.reduce((n, p) => n + p.body.split(/\s+/).length, 0),
      reviewed: false,
      access: 'free',
      priceKes: 0,
      questionCount: quizData.questions.length,
      contentSource: 'g8-is-student-study-v3',
      sourceChars: topic.chars,
      freePageCount: freeCount,
      totalStudyPages: studyPages.length,
      lockPages: LOCK_MODE,
      textbookTitles: ['Grade 8 Rationalized Integrated Science Lesson Notes'],
    },
    sources: [
      {
        id: 'g8-is-notes',
        grade: 'grade-8',
        subject: 'INTEGRATED SCIENCE',
        excerpt: (topic.paragraphs || []).slice(0, 4).join(' ').slice(0, 240),
      },
    ],
  };

  saveLesson(content);
  saveVideo({
    id: randomUUID(),
    type: 'video-script',
    title: `Video: ${topic.topicName}`,
    topic: content.topic,
    pages: { lesson: '', quiz: buildVideoScript(topic, studyPages), answers: '' },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: 80,
      reviewed: false,
      access: 'free',
      priceKes: 0,
      contentSource: 'g8-is-student-study-v3',
      linkedLessonId: content.id,
    },
    sources: content.sources,
  });

  console.log(`  ✓ ${topic.topicNumber} ${topic.topicName}: ${studyPages.length} student pages (unlocked=${!LOCK_MODE})`);
}

console.log('\nDone. Open /learn/grade-8/integrated-science');
