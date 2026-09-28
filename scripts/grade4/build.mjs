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
  },
};

function bullets(items) {
  return items.map((s) => `• ${s}`).join('\n');
}

function divider(title) {
  return `${title.toUpperCase()}\n${'='.repeat(Math.min(60, Math.max(4, title.length)))}`;
}

function overviewPage(pack, strand, sub, meta, L) {
  const parts = [
    divider(L.overview),
    pack.overview,
    `## ${L.strand} ${strand.number}: ${strand.name}\n${L.subStrand} ${sub.number}: ${sub.name}\n${L.suggested}: ${sub.lessons}`,
    `## ${L.outcomes}\n${L.outcomesLead}\n${sub.outcomes.map((o) => `${o.id}) ${o.text}`).join('\n')}`,
  ];
  if (sub.content?.length) parts.push(`## ${L.content}\n${bullets(sub.content)}`);
  if (sub.keyInquiryQuestions?.length) {
    parts.push(`## ${L.kiq}\n${sub.keyInquiryQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`);
  }
  if (sub.coreCompetencies?.length) parts.push(`## ${L.competencies}\n${bullets(sub.coreCompetencies)}`);
  if (sub.values?.length) parts.push(`## ${L.values}\n${bullets(sub.values)}`);
  if (sub.pcis?.length) parts.push(`## ${L.pcis}\n${bullets(sub.pcis)}`);
  if (sub.links?.length) parts.push(`## ${L.links}\n${bullets(sub.links)}`);
  parts.push(`## ${L.source}\n${bullets(pack.sources)}`);
  return parts.join('\n\n');
}

function lessonPage(lesson, sub, L) {
  const outcomeText = lesson.outcomes
    .map((id) => sub.outcomes.find((o) => o.id === id))
    .filter(Boolean)
    .map((o) => `${o.id}) ${o.text}`);
  const parts = [
    divider(`${L.lesson} ${lesson.number}: ${lesson.title}`),
    `## ${L.learn}\n${bullets(lesson.objectives)}\n\n${L.curriculum}: ${outcomeText.join('; ')}`,
    `## ${L.intro}\n${lesson.intro}`,
    `## ${L.notes}\n${lesson.notes}`,
  ];
  if (lesson.diagram?.svg) {
    const caption = lesson.diagram.caption || '';
    parts.push(
      `[DIAGRAM]\nTYPE: svg\nALT: ${caption || lesson.title}\nPAYLOAD:\n${lesson.diagram.svg.replace(/\n/g, ' ')}\nCAPTION: ${caption}\n[/DIAGRAM]`,
    );
  }
  if (lesson.keyWords?.length) {
    parts.push(`## ${L.keyWords}\n${bullets(lesson.keyWords.map((k) => `${k.word} — ${k.meaning}`))}`);
  }
  if (lesson.examples?.length) {
    const ex = lesson.examples.map((e, i) => {
      const steps = (e.steps || []).map((s, j) => `${j + 1}. ${s}`).join('\n');
      return `### ${L.example} ${i + 1}\n${e.problem}${steps ? `\n\n${L.working}:\n${steps}` : ''}\n\n${L.answer}: ${e.answer}`;
    });
    parts.push(`## ${L.examples}\n\n${ex.join('\n\n')}`);
  }
  const act = lesson.activity;
  parts.push(
    `## ${L.activity}: ${act.title}${act.materials?.length ? `\n${L.materials}: ${act.materials.join(', ')}` : ''}\n${act.steps
      .map((s, i) => `${i + 1}. ${s}`)
      .join('\n')}`,
  );
  parts.push(`## ${L.practice}\n${lesson.practice.map((p, i) => `${i + 1}. ${p.question}`).join('\n')}`);
  parts.push(`## ${L.summary}\n${bullets(lesson.summary || [])}`);
  parts.push(`### ${L.practiceAnswers}\n${lesson.practice.map((p, i) => `${i + 1}. ${p.answer}`).join('\n')}`);
  return parts.join('\n\n');
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

function buildRecord(meta, syllabus, strand, sub, order, pack) {
  const L = meta.slug === 'kiswahili' ? LABELS.sw : LABELS.en;
  const studyPages = [
    { pageNumber: 1, title: L.overview.charAt(0) + L.overview.slice(1).toLowerCase(), body: overviewPage(pack, strand, sub, meta, L), free: true },
    ...pack.lessons.map((lesson, i) => ({
      pageNumber: i + 2,
      title: `${L.lesson.charAt(0)}${L.lesson.slice(1).toLowerCase()} ${lesson.number}: ${lesson.title}`,
      body: lessonPage(lesson, sub, L),
      free: true,
    })),
  ];
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
