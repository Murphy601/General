/**
 * Universal Lesson Writer — student-facing 20-page study packs for any CBC grade/subject.
 * Includes MATH WORKING (formula → substitution → steps) and [DIAGRAM] blocks.
 */
import { titleBlock, sectionBlock, toUnicodeFormula, cleanNoise } from './house-style.mjs';
import { formatWorking } from './math-working.mjs';
import { pickDiagram } from './diagram.mjs';
import { buildIntro } from './intros.mjs';
import { matchesBannedIntro, outcomeToGoal } from './config.mjs';

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

function isScience(subject) {
  return /SCIENCE|BIOLOGY|CHEMISTRY|PHYSICS|AGRICULTURE|ENVIRONMENT|HOME SCIENCE/i.test(subject || '');
}

function isEarly(grade) {
  return /^(pp1|pp2|grade-[123])$/i.test(grade || '');
}

function pickFacts(paragraphs, keywords, limit, usedStarts) {
  const used = new Set((usedStarts || []).map((s) => s.toLowerCase()));
  const out = [];
  const push = (raw) => {
    let p = cleanNoise(String(raw || ''));
    p = outcomeToGoal(p.replace(/^[A-Da-d]\)\s*/, '').replace(/^[-•]\s*/, ''));
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

function mathNotes(page, topic, variant) {
  const blob = `${page.title} ${topic.topicName}`.toLowerCase();
  const a = 2 + (variant % 7);
  const b = 3 + (variant % 5);
  const n = 10 + (variant % 40);

  if (/fraction/.test(blob)) {
    return [
      'A fraction names equal parts of a whole: numerator (top) counts parts taken; denominator (bottom) counts equal parts in the whole.',
      `Example: ${a}/${a + b} means ${a} equal parts out of ${a + b}.`,
      'Equivalent fractions name the same amount (2/4 = 1/2).',
      'Always use equal parts — unequal slices are not a fair fraction model.',
      'In Kenya you meet fractions when sharing chapati, measuring half a litre, or reading a recipe.',
    ];
  }
  if (/decimal|percent|percentage/.test(blob)) {
    return [
      'Decimals extend place value to the right of the point: tenths, hundredths, thousandths.',
      '0.25 means 25 hundredths, which equals 1/4.',
      'Percent means “per hundred”: 25% = 25/100 = 0.25.',
      'Line up the decimal points when adding or subtracting.',
      'Money in Kenya (Ksh and cents) is everyday decimal practice.',
    ];
  }
  if (/perimeter|area|volume|capacity|length/.test(blob)) {
    return [
      'Measurement problems need a formula, correct units, and careful substitution.',
      'Perimeter is the distance around a shape. Area is the surface covered. Volume/capacity is space inside.',
      `Example lengths for this page: ${6 + (variant % 5)} cm and ${3 + (variant % 4)} cm.`,
      'Write units in the final answer (cm, m, cm², m², litres).',
      'Sketch the figure and label sides before calculating.',
    ];
  }
  if (/algebra|equation|expression|inequal/.test(blob)) {
    return [
      'An algebraic expression uses numbers and letters (variables) joined by operations.',
      'Like terms have the same variable part — combine them; unlike terms stay separate.',
      'To solve an equation, undo operations carefully on both sides.',
      'Check by substituting your answer back into the original equation.',
      `Example: if x = ${a}, then 2x + ${b} = ${2 * a + b}.`,
    ];
  }
  return [
    `${page.title} belongs to number and measurement work in mathematics.`,
    'Always show the method: write what you know → choose an operation or formula → substitute → compute → check.',
    `Example numbers for this page: ${a} and ${b} (sum ${a + b}, product ${a * b}).`,
    `Place value reminder: read each digit’s place carefully in numbers like ${n}4.`,
    'Units matter: write cm, m, Ksh, or items so the answer matches the question.',
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
    'Use accurate subject words — do not replace them with vague slogans.',
    `Link the idea to a real situation at ${loc} so you can remember it in an exam.`,
    `Respect safety, honesty, and other people when you practise ${name}.`,
    'If two ideas look similar, compare them: say what is the same and what is different.',
  ];
}

function mathWorkingBlock({ page, topic, grade, loc, variant }) {
  const blob = `${page.title} ${topic.topicName}`.toLowerCase();
  const lines = [`Worked situation at ${loc}:`];

  if (/perimeter|rectangle/.test(blob)) {
    const L = 6 + (variant % 7);
    const W = 2 + (variant % 5);
    const P = 2 * (L + W);
    lines.push(`A rectangular plot is ${L} m by ${W} m. Find the perimeter.`);
    lines.push('');
    lines.push(
      formatWorking({
        formula: 'Perimeter = 2(L + W)',
        substitution: `P = 2(${L} + ${W})`,
        steps: [`P = 2(${L + W})`, `P = ${P}`],
        finalAnswer: `${P} m`,
        methodMarks: 'method mark for formula; accuracy mark for answer with units',
      }),
    );
  } else if (/area|square/.test(blob)) {
    const s = 5 + (variant % 8);
    const area = s * s;
    lines.push(`A square garden has side ${s} m. Find the area.`);
    lines.push('');
    lines.push(
      formatWorking({
        formula: 'Area of square = side × side',
        substitution: `Area = ${s} × ${s}`,
        steps: [`Area = ${area}`],
        finalAnswer: `${area} m²`,
        methodMarks: 'method mark; accuracy mark with m²',
      }),
    );
  } else if (/fraction/.test(blob)) {
    const n1 = 1 + (variant % 3);
    const d1 = 4 + (variant % 3);
    lines.push(`Compare or use the fraction ${n1}/${d1} in a sharing problem.`);
    lines.push('');
    lines.push(
      formatWorking({
        formula: 'Fraction = parts taken / equal parts in the whole',
        substitution: `Fraction = ${n1}/${d1}`,
        steps: [`There are ${d1} equal parts; ${n1} part(s) are taken.`, `As a decimal (if needed): ${(n1 / d1).toFixed(2)}`],
        finalAnswer: `${n1}/${d1}`,
        methodMarks: 'method mark for equal parts; accuracy mark for fraction',
      }),
    );
  } else if (/pythagoras|hypotenuse|right.?angl/.test(blob)) {
    lines.push('A right-angled triangle has legs 5 cm and 12 cm. Find the hypotenuse.');
    lines.push('');
    lines.push(
      formatWorking({
        formula: 'c² = a² + b²',
        substitution: 'c² = 5² + 12²',
        steps: ['c² = 25 + 144', 'c² = 169', 'c = 13'],
        finalAnswer: '13 cm',
        methodMarks: 'method mark for Pythagoras; accuracy mark for hypotenuse',
      }),
    );
  } else if (/equation|solve|algebra|linear/.test(blob)) {
    const c = 3 + (variant % 6);
    const x = 4 + (variant % 7);
    const rhs = x + c;
    lines.push(`Solve for x: x + ${c} = ${rhs}.`);
    lines.push('');
    lines.push(
      formatWorking({
        formula: 'x = RHS − constant',
        substitution: `x = ${rhs} − ${c}`,
        steps: [`x = ${x}`, `Check: ${x} + ${c} = ${rhs}`],
        finalAnswer: `x = ${x}`,
        methodMarks: 'method mark; accuracy mark; check mark',
      }),
    );
  } else if (/percent|percentage|decimal/.test(blob)) {
    const whole = 200 + (variant % 5) * 50;
    const pct = 10 + (variant % 4) * 5;
    const ans = (whole * pct) / 100;
    lines.push(`Find ${pct}% of ${whole}.`);
    lines.push('');
    lines.push(
      formatWorking({
        formula: 'Percentage amount = (percent / 100) × whole',
        substitution: `Amount = (${pct}/100) × ${whole}`,
        steps: [`Amount = ${pct / 100} × ${whole}`, `Amount = ${ans}`],
        finalAnswer: String(ans),
        methodMarks: 'method mark; accuracy mark',
      }),
    );
  } else {
    const n = 8 + (variant % 9);
    const p = 10 + (variant % 8) * 5;
    lines.push(`A trader sells ${n} items at Ksh ${p} each. Find the total.`);
    lines.push('');
    lines.push(
      formatWorking({
        formula: 'Total = number × amount each',
        substitution: `Total = ${n} × ${p}`,
        steps: [`Total = ${n * p}`],
        finalAnswer: isEarly(grade) ? `${n * p} (count equal groups to check)` : `Ksh ${n * p}`,
        methodMarks: 'method mark for multiplication; accuracy mark for answer',
      }),
    );
    lines.push('');
    lines.push(`Wrong path to avoid: adding ${n} + ${p} = ${n + p} when equal groups need multiplication.`);
  }
  return lines.join('\n');
}

function scienceWorkingBlock({ page, topic, loc, facts, variant }) {
  const blob = `${page.title} ${topic.topicName}`.toLowerCase();
  if (/pressure|force/.test(blob)) {
    const F = 100 + (variant % 5) * 40;
    const A = [0.2, 0.25, 0.5, 0.4][variant % 4];
    const P = F / A;
    return [
      `Worked situation at ${loc}: calculate pressure.`,
      '',
      formatWorking({
        formula: 'P = F / A',
        substitution: `P = ${F} N / ${A} m²`,
        steps: [`P = ${P}`],
        finalAnswer: `${P} Pa (N/m²)`,
        methodMarks: 'method mark for P = F/A; accuracy mark with Pa',
      }),
    ].join('\n');
  }
  if (/magnification|microscope/.test(blob)) {
    const eye = [5, 10, 15][variant % 3];
    const obj = [4, 10, 40][variant % 3];
    return [
      `Worked situation at ${loc}: microscope lenses.`,
      '',
      formatWorking({
        formula: 'Total magnification = eyepiece × objective',
        substitution: `Total = ${eye} × ${obj}`,
        steps: [`Total = ${eye * obj}`],
        finalAnswer: `×${eye * obj}`,
        methodMarks: 'method mark for multiply; never add lens powers',
      }),
    ].join('\n');
  }
  const fact = facts[0] ? toUnicodeFormula(facts[0]) : page.scope;
  return [
    `Worked situation at ${loc}: a learner investigates ${page.title.toLowerCase()} within ${topic.topicName}.`,
    `Step 1 — Define: ${fact}`,
    `Step 2 — Observe: name one object or process at ${loc} that matches the definition.`,
    'Step 3 — Decide: state whether a common wrong idea fits (usually it does not) and why.',
    'Step 4 — Conclude: write one accurate sentence a teacher can tick, using correct science words.',
  ].join('\n');
}

function workedExample({ page, topic, subject, grade, loc, facts, variant, pageNumber }) {
  let body;
  if (isMath(subject)) {
    body = mathWorkingBlock({ page, topic, grade, loc, variant });
  } else if (isScience(subject)) {
    body = scienceWorkingBlock({ page, topic, loc, facts, variant });
  } else {
    const fact = facts[0] ? toUnicodeFormula(facts[0]) : page.scope;
    body = [
      `Worked situation at ${loc}: a learner investigates ${page.title.toLowerCase()} within ${topic.topicName}.`,
      `First, state the idea clearly: ${fact}`,
      `Next, apply it to one object or action at ${loc} and name what changes or what stays the same.`,
      `Finally, write one accurate conclusion sentence a teacher could tick — using the correct subject words for ${subject}.`,
    ].join('\n');
  }

  const diagram = pickDiagram({
    subject,
    topicName: topic.topicName,
    pageTitle: page.title,
    pageNumber,
    variant,
  });
  if (diagram) {
    body = `${body}\n\n${diagram}`;
  }
  return body;
}

function preserveDiagrams(text, transform) {
  const parts = String(text || '').split(/(\[DIAGRAM\][\s\S]*?\[\/DIAGRAM\])/gi);
  return parts
    .map((part, i) => (i % 2 === 1 || /^\[DIAGRAM\]/i.test(part) ? part : transform(part)))
    .join('');
}

function assemblePage(title, content) {
  const worked = preserveDiagrams(content.worked, toUnicodeFormula);
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
    worked,
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
  ]
    .join('\n')
    .trim();
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
  const intro = buildIntro(page, facts, pageNumber, ledger);
  if (matchesBannedIntro(intro)) {
    throw new Error(`Banned intro leaked on ${topic.subject} / ${page.title}`);
  }

  const notes = isMath(subject)
    ? mathNotes(page, topic, variant)
    : subjectNotes({ page, topic, subject, facts, loc });

  const ideaLabel = String(page.title || '')
    .replace(/^what is\s+/i, '')
    .replace(/\?$/g, '')
    .trim()
    .toLowerCase();

  const goals = [
    `Say what ${ideaLabel} means in plain words.`,
    `Give one Kenyan example linked to ${topic.topicName}.`,
    `Correct one common mistake about this page.`,
  ];

  const worked = workedExample({
    page,
    topic,
    subject,
    grade,
    loc,
    facts,
    variant,
    pageNumber,
  });
  const everyday = `At ${loc}, practise ${ideaLabel} during ordinary routines at home or school. Ask: what did I observe, which word or formula fits, and how do I check I am right? Use the diagram or working on this page as your model. Safety and respect come first.`;
  const summary = notes.slice(0, 4).map((n) => (n.length > 150 ? `${n.slice(0, 147)}...` : n));
  while (summary.length < 3) summary.push(`${ideaLabel} matters for accurate ${subject} learning.`);

  const questions = [
    `Define ${ideaLabel} in your own words and give one clear example.`,
    isMath(subject) || isScience(subject)
      ? `Show full working (or labeled steps) for a problem on this page set at ${loc}.`
      : `Describe a situation at ${loc} that shows ${topic.topicName}, using ideas from this page.`,
    `A learner makes a mistake about ${ideaLabel}. State the wrong idea, correct it, and justify your correction.`,
  ];
  const answers = [
    `${toUnicodeFormula(notes[0] || page.scope)} Example: connect it to something real at home, school, market, or ${loc}.`,
    isMath(subject) || isScience(subject)
      ? 'Award marks for: correct formula/relationship, substitution, steps, and final answer with units (or labeled science steps).'
      : `At ${loc}, observe carefully, name the correct idea from ${topic.topicName}, and explain with one subject fact from the main notes.`,
    `Wrong idea: mixing ${ideaLabel} with a neighbouring concept or skipping the method. Correct idea: ${toUnicodeFormula(outcomeToGoal(page.scope || page.title))}. Justification: follow the worked example (and diagram if shown) on this page.`,
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
    'Answer in your exercise book. Show working or labeled steps where needed. Check with the page answers after you try.',
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
