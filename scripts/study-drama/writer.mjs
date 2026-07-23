/**
 * Agent 1B — Per-page writer (one page per pass)
 */
import { titleBlock, sectionBlock, toUnicodeFormula, cleanNoise } from './house-style.mjs';

const ENGLISH_SYMBOLS = [
  ['Hydrogen', 'H'],
  ['Helium', 'He'],
  ['Carbon', 'C'],
  ['Nitrogen', 'N'],
  ['Oxygen', 'O'],
  ['Fluorine', 'F'],
  ['Neon', 'Ne'],
  ['Magnesium', 'Mg'],
  ['Aluminium', 'Al'],
  ['Chlorine', 'Cl'],
  ['Calcium', 'Ca'],
];

const LATIN_SYMBOLS = [
  ['Sodium', 'Natrium', 'Na'],
  ['Potassium', 'Kalium', 'K'],
  ['Iron', 'Ferrum', 'Fe'],
  ['Copper', 'Cuprum', 'Cu'],
  ['Silver', 'Argentum', 'Ag'],
  ['Gold', 'Aurum', 'Au'],
  ['Lead', 'Plumbum', 'Pb'],
  ['Mercury', 'Hydrargyrum', 'Hg'],
];

const LOCAL = [
  'Lake Magadi salt works',
  'sukuma wiki on a Kisumu plate',
  'a jembe blade from a hardware shop in Nakuru',
  'M-Pesa shop change jar',
  'Marikiti market tomato stall',
  'bottled-water label from a Nairobi supermarket',
  'matatu stage near Nyamakima',
  'a shamba in Nyeri',
  'a school lab in Machakos',
  'a charcoal jiko in Kibera',
  'tea leaves from Kericho',
  'fish from Lake Victoria',
  'ugali and beans in a boarding school dining hall',
  'a solar lantern in Turkana',
  'a water tank on a roof in Thika',
];

function correctKnownErrors(p) {
  let t = p;
  // OCR / draft misconceptions in source notes
  t = t.replace(/liquids have a definite shape just like solids/gi, 'liquids have a definite volume but no definite shape of their own');
  t = t.replace(/Therefore,\s*liquids have a definite shape/gi, 'Therefore, liquids take the shape of their container and have no definite shape');
  t = t.replace(/density generally higher than that of liquid and gas/gi, 'density generally higher than that of liquids and gases');
  return t;
}

function pickFacts(paragraphs, keywords, limit, ledger) {
  const used = new Set((ledger.factStarts || []).map((s) => s.toLowerCase()));
  const out = [];
  for (const raw of paragraphs || []) {
    let p = cleanNoise(raw);
    p = correctKnownErrors(p);
    if (p.length < 25) continue;
    if (keywords && !keywords.test(p)) continue;
    const key = p.slice(0, 56).toLowerCase();
    if (used.has(key)) continue;
    if (/^(Requirements|Procedure|Caution|For example,?)$/i.test(p)) continue;
    // Skip known bad residual lines
    if (/liquids have a definite shape/i.test(p) && !/no definite shape/i.test(p)) continue;
    out.push(p.endsWith('.') ? p : `${p}.`);
    used.add(key);
    if (out.length >= limit) break;
  }
  if (out.length < 3) {
    for (const raw of paragraphs || []) {
      let p = correctKnownErrors(cleanNoise(raw));
      if (p.length < 40) continue;
      if (/liquids have a definite shape/i.test(p) && !/no definite shape/i.test(p)) continue;
      const key = p.slice(0, 56).toLowerCase();
      if (used.has(key)) continue;
      out.push(p.endsWith('.') ? p : `${p}.`);
      used.add(key);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function localExample(pageNumber, ledger) {
  const pool = LOCAL.filter((x) => !(ledger.locals || []).includes(x));
  const choice = pool[(pageNumber - 1) % Math.max(pool.length, 1)] || LOCAL[0];
  ledger.locals = [...(ledger.locals || []), choice];
  return choice;
}

function pageSpecificExamples(topicNumber, page, pageNumber, ledger) {
  const loc = localExample(pageNumber, ledger);
  const key = `${topicNumber}:${page.title}`;
  const banks = {
    '1.1:Rules for Writing Chemical Symbols': [
      `At ${loc}, a learner labels cobalt as CO and is corrected to Co — capitalization changes meaning.`,
      'Rule reminder: first letter capital; second letter lowercase.',
      'CO is carbon monoxide (compound); Co is cobalt (element).',
    ],
    '1.1:Symbols from English Names': ENGLISH_SYMBOLS.map(([n, s]) => `${n}: ${s}`),
    '1.1:Symbols from Latin Names': LATIN_SYMBOLS.map(([n, lat, s]) => `${n}: Latin ${lat} → ${s}`),
    '1.1:Water as a Compound': [
      'Water formula: H₂O (hydrogen and oxygen in a 2:1 atom ratio).',
      `Boiled water for chai at ${loc} is still H₂O — heating is a physical change of state.`,
    ],
    '1.1:Common Salt as a Compound': [
      'Common salt formula: NaCl (sodium and chlorine in a 1:1 ratio).',
      `Salt linked to ${loc} is an everyday compound, not an element.`,
    ],
    '3.2:Formula P Equals F Over A': [
      'Formula: P = F / A',
      'Units: P in pascal (Pa) which is N/m²; F in newtons (N); A in m².',
      'Example: F = 200 N, A = 0.50 m² → P = 200 / 0.50 = 400 Pa.',
    ],
    '2.1:Magnification Formula': [
      'Total magnification = eyepiece magnification × objective magnification.',
      'Example: eyepiece ×10 and objective ×40 → total ×400.',
    ],
    '2.2:Solutes Solvents and Solutions': [
      'Solute: substance that dissolves (sugar, salt).',
      'Solvent: liquid that dissolves the solute (usually water).',
      'Solution: mixture formed when solute dissolves in solvent.',
      `Sweet tea at ${loc} is a solution of sugar (solute) in water (solvent).`,
    ],
  };
  if (banks[key]) return banks[key].map(toUnicodeFormula);

  // Generic unique worked set
  return [
    `Kenyan context for this page: ${loc}.`,
    `Worked focus: apply the idea of "${page.title}" to a real object or event from that setting.`,
    `Formula/symbol check: write any formula with Unicode subscripts (H₂O, CO₂, NaCl) and correct element symbols (N for nitrogen, Fe for iron).`,
  ];
}

function buildQuestions(topicNumber, page, pageNumber, ledger) {
  const title = page.title;
  const scope = page.scope;
  const stemsUsed = ledger.questionStems || [];

  const q1 = `Q-stem ${topicNumber}.${pageNumber}a: In your own words, define ${title} using the scope "${scope}" in two clear Grade 8 sentences.`;
  const q2 = `Q-stem ${topicNumber}.${pageNumber}b: Using one Kenyan setting (home, shamba, market, lab, or clinic), show how ${title} works. Explain the science link in three sentences tied to this page only.`;
  const q3 = `Q-stem ${topicNumber}.${pageNumber}c: A classmate confuses ${title} with a neighbouring idea from an earlier page. Name the confusion, correct it using evidence from PAGE ${pageNumber}, and write a better exam-ready statement.`;

  ledger.questionStems = [...stemsUsed, q1, q2, q3];

  const a1 = `A1 content: ${title} means ${scope}. A Grade 8 answer should use accurate terms and, where relevant, correct symbols or Unicode formulas such as H₂O, CO₂, or NaCl. Stay inside this page scope and avoid myths.`;
  const a2 = `A2 content: Choose one concrete Kenyan example that displays ${title.toLowerCase()}. State what is observed, name the scientific idea from this page, and explain why that idea matters for safety, health, money, or accurate lab work. Do not reuse examples already logged in the covered ledger.`;
  const a3 = `A3 content: The confusion usually mixes ${title.toLowerCase()} with a related but different idea. Correct it by returning to the definition and worked example on PAGE ${pageNumber}. Restate the idea with the proper term, symbol, or formula, and show why the wrong version fails.`;

  return { q1, q2, q3, a1: toUnicodeFormula(a1), a2: toUnicodeFormula(a2), a3: toUnicodeFormula(a3) };
}

function cbcHeader(map, page) {
  return [
    titleBlock(`${map.subStrand}: ${page.title}`),
    '',
    'CBC FRAMING',
    '----',
    `• Strand / Sub-strand: ${map.strand} / ${map.subStrand}`,
    `• Specific Learning Outcome(s): By the end of this page, the learner should be able to explain ${page.title.toLowerCase()} and apply it in a familiar Kenyan context.`,
    `• Key Inquiry Question(s): How does ${page.title.toLowerCase()} help us understand the materials and changes around us?`,
    '• Core competency + value + PCI: Critical thinking and problem solving; responsibility; health education / environmental education as relevant.',
    '',
  ].join('\n');
}

export function writePage({ topic, map, page, pageNumber, totalPages, ledger }) {
  const facts = pickFacts(topic.paragraphs, page.keywords, 8, ledger);
  ledger.factStarts = [
    ...(ledger.factStarts || []),
    ...facts.map((f) => f.slice(0, 56)),
  ];

  const examples = pageSpecificExamples(topic.topicNumber, page, pageNumber, ledger);
  const { q1, q2, q3, a1, a2, a3 } = buildQuestions(topic.topicNumber, page, pageNumber, ledger);

  const overview = [
    sectionBlock('SECTION 1 — CONCEPT OVERVIEW'),
    '',
    `This page focuses on ${page.title}. Scope: ${page.scope}.`,
    '',
    ...facts.map((f) => `• ${toUnicodeFormula(f)}`),
    facts.length
      ? ''
      : `• ${page.title} is a required Grade 8 Integrated Science idea within ${map.subStrand}.`,
    `• Keep definitions exact: ${page.scope}.`,
    '',
  ];

  const worked = [
    sectionBlock('SECTION 2 — WORKED EXAMPLES & FORMULAS'),
    '',
    ...examples.map((e) => `• ${toUnicodeFormula(e)}`),
    '',
  ];

  const practical = [
    sectionBlock('SECTION 3 — PRACTICAL / EVERYDAY APPLICATION'),
    '',
    `• Observe or recall a real situation linked to ${page.title.toLowerCase()} at home, school, market, or shamba.`,
    `• Safety: follow teacher instructions; protect eyes when heating; never taste unknown chemicals; raise alarm early in fire situations.`,
    `• Communication: use correct scientific words when explaining the observation to a classmate or family member.`,
    '',
  ];

  const assessment = [
    sectionBlock('SECTION 4 — ASSESSMENT'),
    '',
    `Q1 [Bloom: Remember/Understand · 2 marks]`,
    q1,
    '',
    `Q2 [Bloom: Apply/Analyse · 4 marks]`,
    q2,
    '',
    `Q3 [Bloom: Evaluate/Create · 5 marks]`,
    q3,
    '',
  ];

  const solutions = [
    sectionBlock('SECTION 5 — FULL STEP-BY-STEP SOLUTIONS'),
    '',
    'A1',
    a1,
    '',
    'A2',
    a2,
    '',
    'A3',
    a3,
    '',
  ];

  const footer = [
    `PAGE ${pageNumber} OF ${totalPages} COMPLETE`,
    '',
    'UPDATED COVERED LEDGER',
    '----',
    `• Examples used: ${(ledger.locals || []).slice(-3).join('; ') || 'n/a'}`,
    `• Question stems logged: ${(ledger.questionStems || []).length}`,
    `• Fact seeds logged: ${(ledger.factStarts || []).length}`,
    '',
    pageNumber < totalPages ? `[CONTINUE: PAGE ${pageNumber + 1}]` : '[CONTINUE: AGENT 2 DISPLAY VALIDATOR]',
  ];

  const body = toUnicodeFormula(
    [
      cbcHeader(map, page),
      `PAGE ${pageNumber} OF ${totalPages}: ${page.title.toUpperCase()}`,
      '====',
      '',
      ...overview,
      ...worked,
      ...practical,
      ...assessment,
      ...solutions,
      ...footer,
    ].join('\n'),
  );

  return { body, ledger };
}

export function buildQuizFromPages(topic, pages) {
  const qs = [];
  const as = [];
  pages.slice(0, 8).forEach((p, i) => {
    const n = i + 1;
    qs.push(`Q${n}. From ${p.title}: state one key definition and one Kenyan example.`);
    as.push(`A${n}. Definition and example must match PAGE ${p.pageNumber} concept overview and practical section.`);
  });
  return {
    quiz: ['REVISION QUIZ', '====', '', ...qs].join('\n'),
    answers: ['ANSWERS', '====', '', ...as].join('\n'),
    questionCount: qs.length,
  };
}
