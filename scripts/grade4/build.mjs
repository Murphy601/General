#!/usr/bin/env node
/**
 * Publish validated Grade 4 lesson packs to the web app.
 *
 * - Validates every subject first and stops if anything fails.
 * - Removes the old template-generated Grade 4 lessons, notes and video scripts.
 * - Writes one topic-lesson per sub-strand to web/data/content/<id>.json and updates index.json.
 * - Replaces Grade 4 in knowledge-base/phase5/curriculum-index.json with the syllabus topics.
 *
 * Usage: node scripts/grade4/build.mjs [--dry-run]
 */
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRADE, GRADE_LABEL, GRADE4_SUBJECTS } from './subjects.mjs';
import { G4_DIR, listSubStrands, loadSyllabus, validateSubject } from './validate.mjs';
import { applyGrade4Index, topicSlug } from './curriculum.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CONTENT_DIR = join(ROOT, 'web', 'data', 'content');
const INDEX_FILE = join(CONTENT_DIR, 'index.json');
const CURRICULUM_INDEX = join(ROOT, 'knowledge-base', 'phase5', 'curriculum-index.json');
const CONTENT_SOURCE = 'kicd-grade4-v1';
const REPLACED_TYPES = new Set(['topic-lesson', 'notes', 'video-script', 'quiz']);
const dryRun = process.argv.includes('--dry-run');

const LABELS = {
  en: {
    overview: 'OVERVIEW',
    strand: 'Strand',
    subStrand: 'Sub-strand',
    suggested: 'Suggested lessons',
    outcomes: 'Learning outcomes',
    outcomesLead: 'By the end of the sub-strand, the learner should be able to:',
    content: 'What this sub-strand covers',
    kiq: 'Key inquiry questions',
    competencies: 'Core competencies',
    values: 'Values',
    pcis: 'Pertinent and contemporary issues',
    links: 'Links to other learning areas',
    source: 'Source',
    lesson: 'LESSON',
    learn: 'What you will learn',
    curriculum: 'Curriculum outcomes',
    intro: 'Introduction',
    notes: 'Notes',
    keyWords: 'Key words',
    examples: 'Worked examples',
    example: 'Example',
    working: 'Working',
    answer: 'Answer',
    activity: 'Activity',
    materials: 'You will need',
    practice: 'Practice',
    practiceAnswers: 'Answers to practice',
    summary: 'Summary',
    quizTitle: 'REVISION QUIZ',
    quizLead: 'Answer all the questions, then mark yourself on the Answers tab.',
    answersTitle: 'ANSWERS',
    pageOverview: 'Overview',
    pageOutcomes: 'Learning outcomes',
    pagePlan: 'How we will learn',
    experiences: 'Learning experiences',
    pageQuiz: 'Revision quiz',
    pageQuizAnswers: 'Quiz answers',
  },
  sw: {
    overview: 'UTANGULIZI WA MADA',
    strand: 'Mada',
    subStrand: 'Mada ndogo',
    suggested: 'Vipindi vinavyopendekezwa',
    outcomes: 'Matokeo maalum yanayotarajiwa',
    outcomesLead: 'Kufikia mwisho wa mada ndogo, mwanafunzi aweze:',
    content: 'Yaliyomo',
    kiq: 'Maswali dadisi',
    competencies: 'Umilisi wa kimsingi',
    values: 'Maadili',
    pcis: 'Masuala mtambuko',
    links: 'Uhusiano na maeneo mengine ya masomo',
    source: 'Chanzo',
    lesson: 'SOMO',
    learn: 'Utakachojifunza',
    curriculum: 'Matokeo ya mtaala',
    intro: 'Utangulizi',
    notes: 'Maelezo',
    keyWords: 'Msamiati',
    examples: 'Mifano',
    example: 'Mfano',
    working: 'Hatua',
    answer: 'Jibu',
    activity: 'Shughuli',
    materials: 'Utahitaji',
    practice: 'Zoezi',
    practiceAnswers: 'Majibu ya zoezi',
    summary: 'Muhtasari',
    quizTitle: 'MASWALI YA MARUDIO',
    quizLead: 'Jibu maswali yote, kisha jisahihishe ukitumia kichupo cha Majibu.',
    answersTitle: 'MAJIBU',
    pageOverview: 'Utangulizi',
    pageOutcomes: 'Matokeo ya kujifunza',
    pagePlan: 'Jinsi ya kujifunza',
    experiences: 'Shughuli za kujifunza',
    pageQuiz: 'Maswali ya marudio',
    pageQuizAnswers: 'Majibu ya maswali',
  },
};

function bullets(items) {
  return items.map((s) => `• ${s}`).join('\n');
}

function divider(title) {
  return `${title.toUpperCase()}\n${'='.repeat(Math.min(60, Math.max(4, title.length)))}`;
}

function quizText(pack, sub, L) {
  const qs = pack.quiz.map((q, i) => {
    const opts = q.options ? `\n${q.options.map((o, j) => `   ${String.fromCharCode(65 + j)}. ${o}`).join('\n')}` : '';
    return `${i + 1}. ${q.question}${opts}`;
  });
  return `${L.quizTitle} — ${sub.number} ${sub.name.toUpperCase()}\n${'='.repeat(40)}\n\n${L.quizLead}\n\n${qs.join('\n\n')}`;
}

function answersText(pack, sub, L) {
  const as = pack.quiz.map((q, i) => {
    let ans = String(q.answer);
    if (q.options && /^[A-Z]$/.test(ans.trim())) {
      const idx = ans.trim().charCodeAt(0) - 65;
      ans = `${ans.trim()}. ${q.options[idx]}`;
    }
    return `${i + 1}. ${ans}${q.explanation ? `\n   ${q.explanation}` : ''}`;
  });
  return `${L.answersTitle} — ${sub.number} ${sub.name.toUpperCase()}\n${'='.repeat(40)}\n\n${as.join('\n\n')}`;
}

function wc(s) {
  return String(s || '').split(/\s+/).filter(Boolean).length;
}

function makeAtom(title, blocks) {
  const kept = blocks.filter((b) => String(b || '').trim());
  const body = kept.join('\n\n');
  return { title, blocks: kept, body, words: wc(body) };
}

function diagramBlock(lesson) {
  if (!lesson.diagram?.svg) return '';
  const caption = lesson.diagram.caption || '';
  return `[DIAGRAM]\nTYPE: svg\nALT: ${caption || lesson.title}\nPAYLOAD:\n${lesson.diagram.svg.replace(/\n/g, ' ')}\nCAPTION: ${caption}\n[/DIAGRAM]`;
}

function exampleBlock(example, index, L) {
  const steps = (example.steps || []).map((s, j) => `${j + 1}. ${s}`).join('\n');
  return `### ${L.example} ${index + 1}\n${example.problem}${steps ? `\n\n${L.working}:\n${steps}` : ''}\n\n${L.answer}: ${example.answer}`;
}

/** Break notes on headings, then on paragraphs, so a long lesson can fill more than one page. */
function noteChunks(notes) {
  const raw = String(notes || '').trim();
  if (!raw) return [];
  const sections = raw.split(/\n(?=### )/).map((s) => s.trim()).filter(Boolean);
  const chunks = [];
  for (const section of sections) {
    if (wc(section) <= 150) {
      chunks.push(section);
      continue;
    }
    const paras = section.split(/\n\n+/);
    let cur = [];
    let n = 0;
    for (const p of paras) {
      const w = wc(p);
      if (cur.length && n + w > 120) {
        chunks.push(cur.join('\n\n'));
        cur = [];
        n = 0;
      }
      cur.push(p);
      n += w;
    }
    if (cur.length) chunks.push(cur.join('\n\n'));
  }
  return chunks;
}

function lessonLabel(lesson, L) {
  const word = `${L.lesson.charAt(0)}${L.lesson.slice(1).toLowerCase()}`;
  return `${word} ${lesson.number}: ${lesson.title}`;
}

/**
 * Study pages are slices of the lesson pack and the official syllabus text.
 * Nothing new is written here: short packs are split more finely, long packs
 * are joined back together, until each topic is about 20 pages.
 */
function studyAtoms(pack, strand, sub, L) {
  const atoms = [];
  atoms.push(makeAtom(L.pageOverview, [
    divider(L.overview),
    pack.overview,
    `## ${L.strand} ${strand.number}: ${strand.name}\n${L.subStrand} ${sub.number}: ${sub.name}\n${L.suggested}: ${sub.lessons}`,
    sub.content?.length ? `## ${L.content}\n${bullets(sub.content)}` : '',
    `## ${L.source}\n${bullets(pack.sources || [])}`,
  ]));
  atoms.push(makeAtom(L.pageOutcomes, [
    `## ${L.outcomes}\n${L.outcomesLead}\n${sub.outcomes.map((o) => `${o.id}) ${o.text}`).join('\n')}`,
    sub.keyInquiryQuestions?.length
      ? `## ${L.kiq}\n${sub.keyInquiryQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      : '',
  ]));
  atoms.push(makeAtom(L.pagePlan, [
    sub.learningExperiences?.length ? `## ${L.experiences}\n${bullets(sub.learningExperiences)}` : '',
    sub.coreCompetencies?.length ? `## ${L.competencies}\n${bullets(sub.coreCompetencies)}` : '',
    sub.values?.length ? `## ${L.values}\n${bullets(sub.values)}` : '',
    sub.pcis?.length ? `## ${L.pcis}\n${bullets(sub.pcis)}` : '',
    sub.links?.length ? `## ${L.links}\n${bullets(sub.links)}` : '',
  ]));

  for (const lesson of pack.lessons || []) {
    const title = lessonLabel(lesson, L);
    const outcomeText = (lesson.outcomes || [])
      .map((id) => sub.outcomes.find((o) => o.id === id))
      .filter(Boolean)
      .map((o) => `${o.id}) ${o.text}`);
    atoms.push(makeAtom(title, [
      divider(title),
      `## ${L.learn}\n${bullets(lesson.objectives || [])}\n\n${L.curriculum}: ${outcomeText.join('; ')}`,
      `## ${L.intro}\n${lesson.intro}`,
    ]));

    const chunks = noteChunks(lesson.notes);
    chunks.forEach((chunk, i) => {
      const heading = (chunk.match(/^###\s+(.+)/) || [])[1];
      const pageTitle = heading
        ? `${title} — ${heading.replace(/\*\*/g, '').trim()}`
        : `${title} — ${L.notes}${chunks.length > 1 ? ` ${i + 1}` : ''}`;
      const blocks = (i === 0 ? [`## ${L.notes}`, chunk] : [chunk]).flatMap((b) => String(b).split(/\n\n+/));
      if (i === chunks.length - 1) {
        const diagram = diagramBlock(lesson);
        if (diagram) blocks.push(diagram);
      }
      atoms.push(makeAtom(pageTitle, blocks));
    });

    if (lesson.keyWords?.length) {
      atoms.push(makeAtom(`${title} — ${L.keyWords}`, [
        `## ${L.keyWords}\n${bullets(lesson.keyWords.map((k) => `${k.word} — ${k.meaning}`))}`,
      ]));
    }
    (lesson.examples || []).forEach((example, i) => {
      atoms.push(makeAtom(`${title} — ${L.example} ${i + 1}`, [
        `## ${L.examples}`,
        exampleBlock(example, i, L),
      ]));
    });
    if (lesson.activity?.steps?.length) {
      const act = lesson.activity;
      atoms.push(makeAtom(`${title} — ${act.title}`, [
        `## ${L.activity}: ${act.title}${act.materials?.length ? `\n${L.materials}: ${act.materials.join(', ')}` : ''}`,
        ...act.steps.map((s, i) => `${i + 1}. ${s}`),
      ]));
    }
    if (lesson.practice?.length) {
      atoms.push(makeAtom(`${title} — ${L.practice}`, [
        `## ${L.practice}`,
        ...lesson.practice.map((p, i) => `${i + 1}. ${p.question}`),
      ]));
      atoms.push(makeAtom(`${title} — ${L.practiceAnswers}`, [
        `## ${L.practiceAnswers}`,
        ...lesson.practice.map((p, i) => `${i + 1}. ${p.answer}`),
      ]));
    }
    if (lesson.summary?.length) {
      atoms.push(makeAtom(`${title} — ${L.summary}`, [
        `## ${L.summary}\n${bullets(lesson.summary)}`,
      ]));
    }
  }

  if (pack.quiz?.length) {
    atoms.push(makeAtom(L.pageQuiz, [
      divider(L.quizTitle),
      L.quizLead,
      ...pack.quiz.map((q, i) => {
        const opts = q.options ? `\n${q.options.map((o, j) => `   ${String.fromCharCode(65 + j)}. ${o}`).join('\n')}` : '';
        return `${i + 1}. ${q.question}${opts}`;
      }),
    ]));
    atoms.push(makeAtom(L.pageQuizAnswers, [
      divider(L.answersTitle),
      ...pack.quiz.map((q, i) => {
        let ans = String(q.answer);
        if (q.options && /^[A-Z]$/i.test(ans.trim())) {
          const idx = ans.trim().toUpperCase().charCodeAt(0) - 65;
          ans = `${ans.trim().toUpperCase()}. ${q.options[idx] || ''}`.trim();
        }
        return `${i + 1}. ${ans}${q.explanation ? `\n   ${q.explanation}` : ''}`;
      }),
    ]));
  }
  return atoms.filter((a) => a.words > 0);
}

function mergeAt(atoms, index) {
  const a = atoms[index];
  const b = atoms[index + 1];
  const merged = makeAtom(a.words >= b.words ? a.title : b.title, [...a.blocks, ...b.blocks]);
  return atoms.slice(0, index).concat([merged], atoms.slice(index + 2));
}

function mergeSmallestPair(atoms) {
  let best = 0;
  let bestW = Infinity;
  for (let i = 0; i < atoms.length - 1; i += 1) {
    const w = atoms[i].words + atoms[i + 1].words;
    if (w < bestW) {
      bestW = w;
      best = i;
    }
  }
  return mergeAt(atoms, best);
}

function splitLargest(atoms) {
  let best = -1;
  for (let i = 0; i < atoms.length; i += 1) {
    if (atoms[i].blocks.length < 2) continue;
    if (best < 0 || atoms[i].words > atoms[best].words) best = i;
  }
  if (best < 0) return null;
  const a = atoms[best];
  let cut = -1;
  let bestDiff = Infinity;
  let left = 0;
  for (let i = 0; i < a.blocks.length - 1; i += 1) {
    left += wc(a.blocks[i]);
    const right = a.words - left;
    if (left < 25 || right < 25) continue;
    const diff = Math.abs(left - right);
    if (diff < bestDiff) {
      bestDiff = diff;
      cut = i + 1;
    }
  }
  if (cut < 0) return null;
  const leftAtom = makeAtom(a.title, a.blocks.slice(0, cut));
  const rightAtom = makeAtom(a.title, a.blocks.slice(cut));
  return atoms.slice(0, best).concat([leftAtom, rightAtom], atoms.slice(best + 1));
}

function paginateStudy(pack, strand, sub, L) {
  let pages = studyAtoms(pack, strand, sub, L);
  while (pages.length > 22) pages = mergeSmallestPair(pages);
  while (pages.length < 18) {
    const next = splitLargest(pages);
    if (!next) break;
    pages = next;
  }
  while (pages.length > 22) pages = mergeSmallestPair(pages);
  // A page under 40 words is a stub. Fold it into the shorter neighbour.
  for (let guard = 0; pages.length > 16 && guard < 40; guard += 1) {
    const i = pages.findIndex((p) => p.words < 40);
    if (i < 0) break;
    const prev = i > 0 ? pages[i - 1].words : Infinity;
    const next = i < pages.length - 1 ? pages[i + 1].words : Infinity;
    pages = mergeAt(pages, prev <= next ? i - 1 : i);
  }
  return pages.map((p, i) => ({
    pageNumber: i + 1,
    title: p.title,
    body: p.body,
    free: true,
  }));
}

function buildRecord(meta, syllabus, strand, sub, order, pack) {
  const L = meta.slug === 'kiswahili' ? LABELS.sw : LABELS.en;
  const studyPages = paginateStudy(pack, strand, sub, L);
  const lessonText = studyPages.map((p) => `PAGE ${p.pageNumber}: ${p.title}\n\n${p.body}`).join('\n\n');
  const words = lessonText.split(/\s+/).filter(Boolean).length;
  return {
    id: `g4-${meta.slug}-${sub.number.replace(/\./g, '-')}`,
    type: 'topic-lesson',
    title: `${GRADE_LABEL} ${meta.subject} — ${sub.number} ${sub.name}`,
    topic: {
      grade: GRADE,
      gradeLabel: GRADE_LABEL,
      subject: meta.subject,
      strand: `${strand.number} ${strand.name}`,
      subStrand: sub.name,
      topicNumber: sub.number,
      topicOrder: order,
      slug: topicSlug(sub),
    },
    pages: {
      lesson: lessonText,
      quiz: quizText(pack, sub, L),
      answers: answersText(pack, sub, L),
      studyPages,
      freePageCount: studyPages.length,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: words,
      reviewed: false,
      access: 'free',
      priceKes: 0,
      contentSource: CONTENT_SOURCE,
      freePageCount: studyPages.length,
      totalStudyPages: studyPages.length,
      lockPages: false,
      questionCount: pack.quiz.length,
      questions: pack.quiz.map((q) => ({
        question: q.question,
        options: q.options,
        correctIndex: q.options ? String(q.answer).trim().charCodeAt(0) - 65 : undefined,
        answer: q.options ? undefined : String(q.answer),
        explanation: q.explanation,
        slo: q.outcome,
      })),
      curriculum: {
        design: `KICD ${GRADE_LABEL} ${meta.subject} Curriculum Design (Revised 2024)`,
        designFileId: meta.fileId,
        strand: `${strand.number} ${strand.name}`,
        subStrand: `${sub.number} ${sub.name}`,
        suggestedLessons: sub.lessons,
        outcomes: sub.outcomes,
      },
    },
    sources: [
      {
        id: meta.fileId,
        subject: meta.subject,
        grade: GRADE,
        excerpt: sub.outcomes.map((o) => `${o.id}) ${o.text}`).join('; ').slice(0, 200),
      },
    ],
  };
}

function indexEntry(record) {
  const { pages, ...rest } = record;
  return {
    ...rest,
    body: `${record.pages.studyPages[0].body.slice(0, 200)}…`,
    pages: { lesson: '', quiz: '', answers: '', freePageCount: pages.freePageCount },
  };
}

// 1. Validate everything first.
let failed = 0;
let syllabusFailed = 0;
const packsBySubject = new Map();
const skipFiles = new Set();
for (const meta of GRADE4_SUBJECTS) {
  const syllabus = loadSyllabus(meta.slug);
  if (!syllabus) continue;
  packsBySubject.set(meta.slug, syllabus);
  for (const r of validateSubject(meta.slug)) {
    if (!r.errors.length) continue;
    failed += r.errors.length;
    console.error(`FAIL ${r.label}`);
    r.errors.slice(0, 8).forEach((e) => console.error(`   ✗ ${e}`));
    if (r.label === `${meta.slug}/syllabus`) syllabusFailed += r.errors.length;
    else skipFiles.add(`${meta.slug}/${r.label.split('/')[1]}`);
  }
}
if (syllabusFailed) {
  console.error(`\n${syllabusFailed} syllabus error(s). Nothing was published.`);
  process.exit(1);
}
if ([...skipFiles].length) {
  console.error(`\nSkipping ${skipFiles.size} lesson file(s) that failed validation.`);
}

// 2. Build records.
const records = [];
for (const meta of GRADE4_SUBJECTS) {
  const syllabus = packsBySubject.get(meta.slug);
  if (!syllabus) continue;
  let built = 0;
  listSubStrands(syllabus).forEach(({ strand, sub }, i) => {
    const file = join(G4_DIR, 'lessons', meta.slug, `${sub.number}.json`);
    if (!existsSync(file)) return;
    if (skipFiles.has(`${meta.slug}/${sub.number}`)) return;
    const pack = JSON.parse(readFileSync(file, 'utf8'));
    records.push(buildRecord(meta, syllabus, strand, sub, i + 1, pack));
    built += 1;
  });
  console.log(`${meta.subject.padEnd(32)} ${built}/${listSubStrands(syllabus).length} sub-strands`);
}

// 3. Swap Grade 4 lessons in the content store.
const index = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
const isReplaced = (item) =>
  item.topic?.grade === GRADE && (REPLACED_TYPES.has(item.type) || item.metadata?.contentSource === CONTENT_SOURCE);
const removed = index.filter(isReplaced);
const kept = index.filter((item) => !isReplaced(item));
const keptIds = new Set(kept.map((i) => i.id));

// Also remove unindexed Grade 4 lesson files left behind by earlier generators.
const orphanIds = [];
for (const name of readdirSync(CONTENT_DIR)) {
  if (!name.endsWith('.json') || name === 'index.json') continue;
  const id = name.slice(0, -5);
  if (keptIds.has(id)) continue;
  const path = join(CONTENT_DIR, name);
  const raw = readFileSync(path, 'utf8');
  if (!raw.includes('"grade-4"')) continue;
  try {
    const item = JSON.parse(raw);
    if (isReplaced(item) && !removed.some((r) => r.id === id)) orphanIds.push(id);
  } catch {
    /* ignore unreadable files */
  }
}

if (process.env.PAGE_SAMPLE) {
  const sample = records.find((r) => r.id === process.env.PAGE_SAMPLE) || records[0];
  console.log(`\nSample ${sample.id}`);
  console.log(sample.pages.studyPages[0].body.slice(0, 280).replace(/\n/g, ' | '));
  for (const p of sample.pages.studyPages) console.log(`${String(p.pageNumber).padStart(2)}  ${String(wc(p.body)).padStart(4)}w  ${p.title}`);
  const allWords = records.flatMap((r) => r.pages.studyPages.map((p) => wc(p.body))).sort((a, b) => a - b);
  console.log(
    `Words per page: min ${allWords[0]}, p10 ${allWords[Math.floor(allWords.length * 0.1)]}, median ${allWords[Math.floor(allWords.length / 2)]}, max ${allWords[allWords.length - 1]}`,
  );
}

const pageCounts = records.map((r) => r.pages.studyPages.length).sort((a, b) => a - b);
const pageHist = {};
for (const n of pageCounts) pageHist[n] = (pageHist[n] || 0) + 1;
const thinPages = records.filter((r) => r.pages.studyPages.length < 18);
console.log(
  `Study pages per topic: min ${pageCounts[0]}, median ${pageCounts[Math.floor(pageCounts.length / 2)]}, max ${pageCounts[pageCounts.length - 1]}`,
);
console.log(`Page-count spread: ${JSON.stringify(pageHist)}`);
if (thinPages.length) {
  console.log(
    `${thinPages.length} topic(s) under 18 pages: ${thinPages.slice(0, 8).map((r) => `${r.id}=${r.pages.studyPages.length}`).join(', ')}`,
  );
}

console.log(
  `\nRemoving ${removed.length} indexed + ${orphanIds.length} unindexed old Grade 4 items; publishing ${records.length} lessons.`,
);
if (dryRun) {
  console.log('Dry run — no files written.');
  process.exit(0);
}

for (const id of [...removed.map((r) => r.id), ...orphanIds]) {
  const path = join(CONTENT_DIR, `${id}.json`);
  if (existsSync(path)) unlinkSync(path);
}
for (const record of records) {
  writeFileSync(join(CONTENT_DIR, `${record.id}.json`), JSON.stringify(record, null, 2));
}
writeFileSync(INDEX_FILE, JSON.stringify([...records.map(indexEntry), ...kept], null, 2));

const curriculum = applyGrade4Index(JSON.parse(readFileSync(CURRICULUM_INDEX, 'utf8')));
writeFileSync(CURRICULUM_INDEX, JSON.stringify(curriculum, null, 2));
console.log('Updated web/data/content/index.json and knowledge-base/phase5/curriculum-index.json');
