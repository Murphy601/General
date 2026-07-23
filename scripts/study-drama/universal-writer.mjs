/**
 * Universal Lesson Writer — student-facing 20-page study packs for any CBC grade/subject.
 * Includes MATH WORKING (formula → substitution → steps) and [DIAGRAM] blocks.
 */
import { titleBlock, sectionBlock, toUnicodeFormula, cleanNoise } from './house-style.mjs';
import { formatWorking } from './math-working.mjs';
import { pickDiagram } from './diagram.mjs';
import { buildIntro } from './intros.mjs';
import { matchesBannedIntro, outcomeToGoal, hasLocationFiller } from './config.mjs';
import { needsCalcQuiz, buildCalcQuizItem, buildCalcHeavyPageQA } from './quiz-calc.mjs';

function hash(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0;
  return h;
}

/** Topic/subtopic focus phrase — never a place-name scene */
function topicFocus(page, topic) {
  const idea = String(page.title || topic.topicName || 'this idea')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
  return idea;
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

function subjectNotes({ page, topic, subject, facts }) {
  if (facts.length) {
    return facts.slice(0, 6).map((f) => toUnicodeFormula(f));
  }
  const name = topic.topicName;
  return [
    `${page.title} helps you understand ${name} in ${subject}.`,
    `Meaning in plain words: ${page.scope}.`,
    'Use accurate subject words — do not replace them with vague slogans.',
    `Link ${name} to a clear example from this subtopic so you can remember it in an exam.`,
    `Respect safety, honesty, and other people when you practise ${name}.`,
    'If two ideas look similar, compare them: say what is the same and what is different.',
  ];
}

function mathWorkingBlock({ page, topic, grade, variant }) {
  const blob = `${page.title} ${topic.topicName}`.toLowerCase();
  const lines = [`Worked example on ${topic.topicName}:`];

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

function scienceWorkingBlock({ page, topic, facts, variant }) {
  const blob = `${page.title} ${topic.topicName}`.toLowerCase();
  if (/pressure|force/.test(blob)) {
    const F = 100 + (variant % 5) * 40;
    const A = [0.2, 0.25, 0.5, 0.4][variant % 4];
    const P = F / A;
    return [
      `Worked example on ${topic.topicName}: calculate pressure.`,
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
      `Worked example on ${topic.topicName}: microscope lenses.`,
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
    `Worked example on ${page.title} within ${topic.topicName}.`,
    `Step 1 — Define: ${fact}`,
    `Step 2 — Observe: name one object or process from this subtopic that matches the definition.`,
    'Step 3 — Decide: state whether a common wrong idea fits (usually it does not) and why.',
    'Step 4 — Conclude: write one accurate sentence a teacher can tick, using correct science words.',
  ].join('\n');
}

function workedExample({ page, topic, subject, grade, facts, variant, pageNumber }) {
  let body;
  if (isMath(subject)) {
    body = mathWorkingBlock({ page, topic, grade, variant });
  } else if (isScience(subject)) {
    body = scienceWorkingBlock({ page, topic, facts, variant });
  } else {
    const fact = facts[0] ? toUnicodeFormula(facts[0]) : page.scope;
    body = [
      `Worked example on ${page.title} within ${topic.topicName}.`,
      `First, state the idea clearly: ${fact}`,
      `Next, apply it to one clear example from this subtopic and name what changes or what stays the same.`,
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
  const focus = topicFocus(page, topic);
  const subject = topic.subject || map.subject || 'CBC';
  const grade = topic.grade || '';
  const paras = topic.paragraphs || [];
  const usedStarts = ledger.factStarts || [];
  const facts = pickFacts(paras, page.keywords, 8, usedStarts);
  ledger.factStarts = [...usedStarts, ...facts.map((f) => f.slice(0, 56))];

  const variant = hash(page.title + String(pageNumber)) + pageNumber;
  const intro = buildIntro(page, facts, pageNumber, ledger);
  if (matchesBannedIntro(intro) || hasLocationFiller(intro)) {
    throw new Error(`Banned/location intro leaked on ${topic.subject} / ${page.title}`);
  }

  const notes = isMath(subject)
    ? mathNotes(page, topic, variant)
    : subjectNotes({ page, topic, subject, facts });

  const ideaLabel = String(page.title || '')
    .replace(/^what is\s+/i, '')
    .replace(/\?$/g, '')
    .trim()
    .toLowerCase();

  const goals = [
    `Say what ${ideaLabel} means in plain words.`,
    `Give one clear example linked to ${topic.topicName}.`,
    `Correct one common mistake about this page.`,
  ];

  const worked = workedExample({
    page,
    topic,
    subject,
    grade,
    facts,
    variant,
    pageNumber,
  });
  const everyday = `Practise ${topic.topicName}: focus on ${ideaLabel}. Ask which key word or formula fits, then check your answer against the worked example and diagram on this page. Careful checking comes first.`;
  const summary = notes.slice(0, 4).map((n) => (n.length > 150 ? `${n.slice(0, 147)}...` : n));
  while (summary.length < 3) summary.push(`${ideaLabel} matters for accurate ${subject} learning.`);

  const { questions, answers } = buildPageRevisionQA({
    ideaLabel,
    topicName: topic.topicName,
    subject,
    notes,
    scope: page.scope || page.title,
    variant: pageNumber + variant,
    grade,
  });

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
    meta: { pageNumber, totalPages, focus },
  };
}

function shortIdea(title) {
  return String(title || 'this idea')
    .replace(/^understanding\s+/i, '')
    .replace(/^key words you must know:\s*/i, '')
    .replace(/^how it works step by step:\s*/i, '')
    .replace(/^look closely — examples:\s*/i, '')
    .replace(/^try it yourself:\s*/i, '')
    .replace(/^try it with local materials:\s*/i, '')
    .replace(/^common mistakes(?: to avoid)?(?:\s*[—–-]\s*.+)?$/i, 'common mistakes on this topic')
    .replace(/^compare and contrast(?:\s*[—–-]\s*.+)?$/i, 'how two close ideas differ')
    .replace(/^safety and respect(?:\s*[—–-]\s*.+)?$/i, 'safe, careful practice of this topic')
    .replace(/^practice with numbers or facts(?:\s*[—–-]\s*.+)?$/i, 'practising with numbers or facts')
    .replace(/^tell it in your own words(?:\s*[—–-]\s*.+)?$/i, 'explaining the idea in your own words')
    .replace(/^home and school(?:\s*[—–-]\s*.+)?$/i, 'using the idea at home and school')
    .replace(/^community and kenya(?:\s*[—–-]\s*.+)?$/i, 'using the idea in the community')
    .replace(/^worked problem(?:\s*[—–-]\s*.+)?$/i, 'a worked problem on this topic')
    .replace(/^check your understanding(?:\s*[—–-]\s*.+)?$/i, 'checking understanding')
    .replace(/^harder challenge(?:\s*[—–-]\s*.+)?$/i, 'a harder challenge on this topic')
    .replace(/^values and attitudes(?:\s*[—–-]\s*.+)?$/i, 'values linked to this topic')
    .replace(/^exam-style practice(?:\s*[—–-]\s*.+)?$/i, 'exam-style practice')
    .replace(/^revision sprint(?:\s*[—–-]\s*.+)?$/i, 'a quick revision sprint')
    .replace(/^fix the wrong idea(?:\s*[—–-]\s*.+)?$/i, 'fixing a wrong idea')
    .replace(/^topic synthesis(?:\s*[—–-]\s*.+)?$/i, 'pulling the whole topic together')
    .replace(/^common mistakes:\s*/i, '')
    .replace(/\u2026/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)
    .toLowerCase() || 'this idea';
}

function isMetaPhaseTitle(title) {
  return /^(common mistakes|compare and contrast|safety and respect|practice with|tell it|home and school|community and|worked problem|check your|harder challenge|values and|exam-style|revision sprint|fix the wrong|topic synthesis)/i.test(
    String(title || '').trim(),
  );
}

function extractSection(body, name) {
  const re = new RegExp(`${name}\\n----\\n([\\s\\S]*?)(?=\\n\\n[A-Z][A-Z ]+\\n----|$)`, 'i');
  return (String(body || '').match(re) || [])[1] || '';
}

function extractBullets(section) {
  return String(section || '')
    .split('\n')
    .map((l) => l.replace(/^•\s*/, '').trim())
    .filter((l) => l.length > 12);
}

/** Engaging page-level revision Q&A (not plain “Define…”) */
export function buildPageRevisionQA({ ideaLabel, topicName, subject, notes, scope, variant = 0, grade = '' }) {
  const idea = shortIdea(ideaLabel);
  const topic = String(topicName || 'this topic').trim();
  const fact = toUnicodeFormula(notes?.[0] || scope || idea);
  const fact2 = toUnicodeFormula(notes?.[1] || notes?.[0] || scope || idea);
  const goal = toUnicodeFormula(outcomeToGoal(scope || idea));
  const v = Math.abs(Number(variant) || 0);

  // Math / science / quantitative subjects → real CALCULATE items with workings
  if (needsCalcQuiz(subject, topic, ideaLabel) && !isMetaPhaseTitle(ideaLabel)) {
    return buildCalcHeavyPageQA({
      ideaLabel,
      topicName: topic,
      subject,
      grade,
      notes,
      scope,
      variant: v,
    });
  }

  const allowCalc = needsCalcQuiz(subject, topic, ideaLabel);
  // Meta pages on calc topics still get one numerical item
  if (allowCalc && isMetaPhaseTitle(ideaLabel)) {
    const calc = buildCalcQuizItem({
      subject,
      topicName: topic,
      pageTitle: topic,
      grade,
      variant: v + 5,
    });
    return {
      questions: [
        calc.question,
        `COMPARE: How does careful working on ${topic} differ from guessing? Give one numerical check.`,
        `SPOT THE ERROR: A learner skips a step on ${topic}. State the wrong path and correct it with working.`,
      ],
      answers: [
        calc.answer,
        `Careful working uses formula → substitute → steps → units/check. Guessing skips method marks. Numerical check:\n${calc.answer}`,
        `Wrong path: answer without method. Correct approach:\n${calc.answer}`,
      ],
    };
  }

  const stemSets = [
    [
      `TRAP: A classmate says “${idea} is basically the same as any nearby idea in ${topic}.” What is wrong with that claim, and what exact distinction should they learn?`,
      `SCENE: You must prove you understand ${idea} using one real example from ${topic}. Describe the example, name the key idea, and explain why a near-miss example would fail.`,
      `SPOT THE ERROR: A learner mixes up ${idea} with a neighbouring concept (or skips a key step). State their wrong idea, correct it, and justify using a fact from this page.`,
    ],
    [
      `NEAR-MISS: Write two answers about ${idea} — one that earns full marks and one that looks clever but loses marks. Explain the difference in one sentence.`,
      `COMPARE: How does ${idea} differ from the closest confusing idea in ${topic}? Give one test question that separates them.`,
      `EXAM PRESSURE (4 marks): Answer on ${idea} using this mark scheme — (1) accurate meaning, (2) example from ${topic}, (3) method/reason, (4) check or caution.`,
    ],
    [
      `WHY NOT: Someone uses the wrong word, formula, or method for ${idea}. State the wrong choice, the right choice, and one reason a teacher would reject the wrong one.`,
      `TEACH IT: Explain ${idea} to a younger learner in ${topic} using one analogy and one accurate subject sentence. Then warn them about one common mix-up.`,
      `JUDGE: Which claim is safer for an exam on ${idea} — a vague slogan or a precise definition with an example? Defend your choice with a fact from this page.`,
    ],
  ];
  const questions = stemSets[v % stemSets.length];
  const answers = [
    `Wrong claim: treating ${idea} as interchangeable with a neighbouring idea in ${topic}. Accurate distinction: ${goal}. Supporting fact: ${fact}`,
    `Strong answer: name ${idea} accurately, give one concrete example from ${topic}, and link it to this fact: ${fact}. A near-miss fails when the example matches a different idea.`,
    `Wrong idea: confusing ${idea} with a neighbour or skipping the method. Correct idea: ${goal}. Justification: ${fact} — match the worked example on this page before you finalise.`,
  ];
  return { questions, answers };
}

/**
 * Build Revision Quiz + Answers tab content from study pages.
 * Returns { quiz, answers, questionCount } — never leave answers empty.
 * Math/science topics get real CALCULATE items with full workings.
 */
export function buildQuizFromUniversalPages(studyPages, topic) {
  const subject = topic.subject || 'CBC';
  const topicName = topic.topicName || 'this topic';
  const grade = topic.grade || '';
  const calcSubject = needsCalcQuiz(subject, topicName);

  const quizLines = [
    titleBlock(`${subject} — ${topicName} · Revision Quiz`),
    '',
    calcSubject
      ? 'Show full working for every CALCULATE question (formula → substitute → steps → units/check). Then mark yourself on the Answers tab.'
      : 'Try each question in your exercise book first. Then open the Answers tab to mark yourself.',
    '',
  ];
  const answerLines = [
    titleBlock(`${subject} — ${topicName} · Answers`),
    '',
    calcSubject
      ? 'Award method marks for correct formula and substitution even if the final number is slightly off — but only when the reasoning matches.'
      : 'Mark yourself honestly. Award method marks when the reasoning matches.',
    '',
  ];

  const pages = (studyPages || []).slice(0, 10);
  let n = 1;

  if (calcSubject) {
    // Dedicated numerical quiz bank for quantitative subjects
    for (let i = 0; i < Math.max(8, Math.min(10, pages.length || 8)); i++) {
      const p = pages[i % Math.max(pages.length, 1)] || { title: topicName };
      const item = buildCalcQuizItem({
        subject,
        topicName,
        pageTitle: `${p.title} ${topicName}`,
        grade,
        variant: i * 13 + n,
      });
      quizLines.push(`${n}. ${item.question}`);
      answerLines.push(`${n}. ${item.answer}`);
      n++;
    }
    // One conceptual closer that still demands a numerical check
    const closer = buildCalcQuizItem({
      subject,
      topicName,
      pageTitle: topicName,
      grade,
      variant: 99,
    });
    quizLines.push(
      `${n}. SYNTHESIS + CALCULATE: Name the method step learners skip most often in ${topicName}, then solve this to prove you did not skip it:\n${closer.question.replace(/^CALCULATE:\s*/i, '')}`,
    );
    answerLines.push(
      `${n}. Common skip: jumping to an answer without formula/substitution/check.\nCorrect working:\n${closer.answer}`,
    );
  } else {
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const notes = extractBullets(extractSection(p.body, 'MAIN NOTES'));
      const scopeSec = extractSection(p.body, 'WHAT YOU WILL LEARN');
      const scope = (scopeSec.match(/•\s*(.+)/) || [])[1] || p.title;
      const pack = buildPageRevisionQA({
        ideaLabel: p.title,
        topicName,
        subject,
        notes: notes.length ? notes : [scope],
        scope,
        variant: i + n,
        grade,
      });
      const qi = i % pack.questions.length;
      quizLines.push(`${n}. (${p.title}) ${pack.questions[qi]}`);
      answerLines.push(`${n}. ${pack.answers[qi]}`);
      n++;
    }
    quizLines.push(
      `${n}. SYNTHESIS: Across ${topicName}, name the one idea a learner most often confuses, state the accurate version, and give one quick check that proves they finally understand it.`,
    );
    answerLines.push(
      `${n}. Strong synthesis: pick the most common mix-up in ${topicName}, replace it with the accurate definition from the study pages, and prove it with a short example or “wrong vs right” contrast from the notes.`,
    );
  }

  return {
    quiz: quizLines.join('\n'),
    answers: answerLines.join('\n'),
    questionCount: n,
  };
}
