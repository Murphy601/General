/**
 * Universal Lesson Writer — student-facing 20-page study packs for any CBC grade/subject.
 * Same house style as Study-Drama Engine (plain text, no scaffolding leak).
 */
import { titleBlock, sectionBlock, toUnicodeFormula, cleanNoise } from './house-style.mjs';
import { formatWorking } from './math-working.mjs';
import { matchesBannedIntro } from './config.mjs';

const LOCALS = [
  'a classroom in Kisumu',
  'a home in Nakuru',
  'a market in Nairobi',
  'a shamba in Nyeri',
  'a school compound in Machakos',
  'a duka in Mombasa',
  'a playground in Eldoret',
  'a clinic bench in Thika',
  'a church/mosque yard in Kakamega',
  'a tea farm path in Kericho',
  'a fishing beach near Lake Victoria',
  'a boarding dorm in Kitale',
  'a matatu stage in Nyeri',
  'a kitchen in Kibera',
  'a library corner in Garissa',
];

function hash(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0;
  return h;
}

function nextLocal(ledger) {
  const used = ledger.locals || [];
  const pool = LOCALS.filter((x) => !used.includes(x));
  const choice = pool[0] || LOCALS[used.length % LOCALS.length];
  ledger.locals = [...used, choice];
  return choice;
}

function isMath(subject) {
  return /MATH|NUMERACY|ARITHMETIC/i.test(subject || '');
}

function isEarly(grade) {
  return /^(pp1|pp2|grade-[123])$/i.test(grade || '');
}

function pickFacts(paragraphs, keywords, limit, usedStarts) {
  const used = new Set((usedStarts || []).map((s) => s.toLowerCase()));
  const out = [];
  const push = (raw) => {
    let p = cleanNoise(String(raw || ''));
    if (p.length < 24) return;
    if (/^(Requirements|Procedure|Caution|For example,?)$/i.test(p)) return;
    const key = p.slice(0, 56).toLowerCase();
    if (used.has(key)) return;
    used.add(key);
    out.push(p.endsWith('.') ? p : `${p}.`);
  };
  for (const raw of paragraphs || []) {
    if (keywords && !keywords.test(raw)) continue;
    push(raw);
    if (out.length >= limit) return out;
  }
  for (const raw of paragraphs || []) {
    push(raw);
    if (out.length >= limit) break;
  }
  return out;
}

function buildIntro({ page, topic, subject, grade, loc, facts }) {
  const title = page.title;
  const idea = page.outcome || page.scope || title;
  const early = isEarly(grade);
  const openers = early
    ? [
        `At ${loc}, you can practise ${title.toLowerCase()} with things you can see and touch.`,
        `Today we learn about ${topic.topicName}. Start with one clear example from ${loc}.`,
        `Look around ${loc}. ${topic.topicName} shows up in small daily actions — this page names them clearly.`,
      ]
    : [
        `At ${loc}, ${title.toLowerCase()} is not just a heading — it is a skill you use when you explain ${topic.topicName} with evidence.`,
        `A learner studying ${subject} meets ${title.toLowerCase()} first by naming the idea, then by using one Kenyan example from ${loc}.`,
        `This page teaches ${title.toLowerCase()} so you can define it, apply it near ${loc}, and correct a common wrong idea.`,
      ];
  const seed = hash(title + loc + (facts[0] || ''));
  let intro = `${openers[seed % openers.length]} In plain words: ${idea}.`;
  if (facts[0]) intro += ` One useful fact to keep: ${facts[0].replace(/\.$/, '')}.`;
  if (matchesBannedIntro(intro)) {
    intro = `This lesson explains ${title} for ${topic.topicName}. You will learn the meaning, one worked example linked to ${loc}, and how to avoid a common mistake.`;
  }
  return intro;
}

function mathNotes(page, variant) {
  const a = 2 + (variant % 7);
  const b = 3 + (variant % 5);
  const n = 10 + (variant % 40);
  return [
    `${page.title} belongs to number and measurement work in mathematics.`,
    `Always show the method: write what you know, choose an operation, compute carefully, then check with a reverse step.`,
    `Example numbers for this page: ${a} and ${b} combine in different ways — sum ${a + b}, product ${a * b}.`,
    `Place value reminder: in ${n}4, the digit 4 can mean ones, tens, or another place depending on where it sits — read the place carefully.`,
    `Units matter: write cm, m, Ksh, or items so the answer matches the question.`,
  ];
}

function subjectNotes({ page, topic, subject, facts, loc }) {
  if (facts.length) {
    return facts.slice(0, 6).map((f) => toUnicodeFormula(f));
  }
  const name = topic.topicName;
  return [
    `${page.title} helps you understand ${name} in ${subject}.`,
    `Meaning in plain words: ${page.scope}.`,
    `Use accurate subject words — do not replace them with vague slogans.`,
    `Link the idea to a real situation at ${loc} so you can remember it in an exam.`,
    `Respect safety, honesty, and other people when you practise ${name}.`,
    `If two ideas look similar, compare them: say what is the same and what is different.`,
  ];
}

function workedExample({ page, topic, subject, grade, loc, facts, variant }) {
  if (isMath(subject)) {
    const n = 8 + (variant % 9);
    const p = 10 + (variant % 8) * 5;
    return [
      `Worked situation at ${loc}: a learner solves a ${topic.topicName.toLowerCase()} problem.`,
      '',
      formatWorking({
        formula: 'Total = number × amount each',
        substitution: `Total = ${n} × ${p}`,
        steps: [`Total = ${n * p}`],
        finalAnswer: isEarly(grade) ? `${n * p} (count the groups to check)` : `Ksh ${n * p} (or ${n * p} items)`,
        methodMarks: 'method mark for correct operation; accuracy mark for answer',
      }),
      '',
      `Wrong path to avoid: adding ${n} + ${p} = ${n + p} when the question needs groups of equal size. Multiplication matches equal groups.`,
    ].join('\n');
  }
  const fact = facts[0] ? toUnicodeFormula(facts[0]) : page.scope;
  return [
    `Worked situation at ${loc}: a learner investigates ${page.title.toLowerCase()} within ${topic.topicName}.`,
    `First, state the idea clearly: ${fact}`,
    `Next, apply it to one object or action at ${loc} and name what changes or what stays the same.`,
    `Finally, write one accurate conclusion sentence a teacher could tick — using the correct subject words for ${subject}.`,
  ].join(' ');
}

function assemblePage(title, content) {
  return [
    titleBlock(title),
    '',
    sectionBlock('WHAT YOU WILL LEARN'),
    ...content.goals.map((g) => `• ${g}`),
    '',
    sectionBlock('INTRODUCTION'),
    content.intro,
    '',
    sectionBlock('MAIN NOTES'),
    ...content.notes.map((n) => `• ${toUnicodeFormula(n)}`),
    '',
    sectionBlock('WORKED EXAMPLE'),
    toUnicodeFormula(content.worked),
    '',
    sectionBlock('IN EVERYDAY LIFE'),
    toUnicodeFormula(content.everyday),
    '',
    sectionBlock('SUMMARY'),
    ...content.summary.map((s) => `• ${toUnicodeFormula(s)}`),
    '',
    sectionBlock('REVISION QUESTIONS'),
    ...content.questions.map((q, i) => `${i + 1}. ${q}`),
    '',
    sectionBlock('ANSWERS'),
    ...content.answers.map((a, i) => `${i + 1}. ${toUnicodeFormula(a)}`),
  ].join('\n').trim();
}

export function writeUniversalPage({ topic, map, page, pageNumber, totalPages, ledger }) {
  const loc = nextLocal(ledger);
  const subject = topic.subject || map.subject || 'CBC';
  const grade = topic.grade || '';
  const paras = topic.paragraphs || [];
  const usedStarts = ledger.factStarts || [];
  const facts = pickFacts(paras, page.keywords, 8, usedStarts);
  ledger.factStarts = [...usedStarts, ...facts.map((f) => f.slice(0, 56))];

  const variant = hash(page.title + String(pageNumber)) + (ledger.locals?.length || 0);
  const intro = buildIntro({ page, topic, subject, grade, loc, facts });
  ledger.introFingerprints = [...(ledger.introFingerprints || []), intro.slice(0, 64).toLowerCase()];

  const notes = isMath(subject)
    ? mathNotes(page, variant)
    : subjectNotes({ page, topic, subject, facts, loc });

  const goals = [
    `Say what ${page.title.toLowerCase()} means in plain words.`,
    `Give one Kenyan example linked to ${topic.topicName}.`,
    `Correct one common mistake about this page.`,
  ];

  const worked = workedExample({ page, topic, subject, grade, loc, facts, variant });
  const everyday = `At ${loc}, practise ${page.title.toLowerCase()} during ordinary routines at home or school. Ask: what did I observe, which word fits, and how do I check I am right? Safety and respect come first.`;
  const summary = notes.slice(0, 4).map((n) => (n.length > 150 ? `${n.slice(0, 147)}...` : n));
  while (summary.length < 3) summary.push(`${page.title} matters for accurate ${subject} learning.`);

  const questions = [
    `Define ${page.title.toLowerCase()} in your own words and give one clear example.`,
    `Describe a situation at ${loc} that shows ${topic.topicName}, using ideas from this page.`,
    `A learner makes a mistake about ${page.title.toLowerCase()}. State the wrong idea, correct it, and justify your correction.`,
  ];
  const answers = [
    `${toUnicodeFormula(notes[0] || page.scope)} Example: connect it to something real at home, school, market, or ${loc}.`,
    `At ${loc}, observe carefully, name the correct idea from ${topic.topicName}, and explain with one subject fact from the main notes.`,
    `Wrong idea: mixing ${page.title.toLowerCase()} with a neighbouring concept or skipping the method. Correct idea: ${toUnicodeFormula(page.scope)}. Justification: follow the worked example steps on this page.`,
  ];

  const body = assemblePage(page.title, {
    goals,
    intro,
    notes,
    worked,
    everyday,
    summary,
    questions,
    answers,
  });

  return {
    body,
    ledger,
    meta: { pageNumber, totalPages, local: loc },
  };
}

export function buildQuizFromUniversalPages(studyPages, topic) {
  const lines = [
    titleBlock(`${topic.subject} — ${topic.topicName} · Quick Check`),
    '',
    'Answer in your exercise book. Check with the page answers after you try.',
    '',
  ];
  let n = 1;
  for (const p of studyPages.slice(0, 8)) {
    const qs = (p.body.match(/^REVISION QUESTIONS\n----\n([\s\S]*?)\n\nANSWERS/m) || [])[1] || '';
    const first = qs.split('\n').find((l) => /^1\./.test(l));
    if (first) {
      lines.push(`${n}. (From “${p.title}”) ${first.replace(/^1\.\s*/, '')}`);
      n++;
    }
  }
  return lines.join('\n');
}
