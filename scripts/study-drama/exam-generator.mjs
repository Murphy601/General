/**
 * Agent 5 — Exam & Paper Generator (KJSEA-aligned for Grade 8 Integrated Science)
 */
import { randomUUID } from 'node:crypto';
import { titleBlock, sectionBlock, toUnicodeFormula } from './house-style.mjs';
import { formatWorking } from './math-working.mjs';
import { pressureForceAreaSvg, fireTriangleSvg } from './diagram.mjs';
import { CONFIG } from './config.mjs';

const TIER_META = {
  GENERAL: {
    type: 'exam',
    category: 'general',
    label: 'General Assessment',
    time: '45 minutes',
    totalMarks: 30,
    mcq: 10,
    structured: 4,
    bloomRecallPct: 0.7,
    access: 'free',
    priceKes: 0,
  },
  TERMLY: {
    type: 'termly-exam',
    category: 'termly',
    label: 'Termly Exam',
    time: '1 hour 30 minutes',
    totalMarks: 50,
    mcq: 15,
    structured: 5,
    bloomRecallPct: 0.5,
    access: 'free',
    priceKes: 50,
  },
  MOCK: {
    type: 'mock-exam',
    category: 'mock',
    label: 'Mock Exam',
    time: '2 hours',
    totalMarks: 80,
    mcq: 20,
    structured: 6,
    bloomRecallPct: 0.35,
    access: 'paid',
    priceKes: 100,
  },
  PREMIUM: {
    type: 'premium-exam',
    category: 'premium',
    label: 'Premium Exam',
    time: '2 hours 30 minutes',
    totalMarks: 100,
    mcq: 25,
    structured: 8,
    bloomRecallPct: 0.25,
    access: 'paid',
    priceKes: 150,
  },
};

/** Item bank with variants — numbers/contexts mutate per paper index */
function itemBank(variant) {
  const v = variant % 17;
  const F = 100 + v * 20;
  const A = [0.25, 0.5, 0.4, 0.2][v % 4];
  const P = F / A;
  const eye = [10, 10, 5, 15][v % 4];
  const obj = [4, 10, 40, 40][v % 4];
  const mag = eye * obj;

  return [
    {
      id: `el-def-${v}`,
      bloom: 'recall',
      stem: 'Which statement correctly defines an element?',
      choices: [
        'A pure substance that cannot be broken down into a simpler substance by chemical or physical means',
        'Any white crystal used in cooking',
        'A mixture of two liquids',
        'A substance that always conducts electricity',
      ],
      answer: 0,
      whyWrong: ['Looks pure ≠ element', 'Mixtures are not elements', 'Conduction is not the definition'],
    },
    {
      id: `sym-ca-${v}`,
      bloom: 'apply',
      stem: 'A learner writes calcium as CA. What is the correct symbol and rule?',
      choices: [
        'Ca — first letter capital, second letter small',
        'CA — both letters must be capitals',
        'ca — both letters must be small',
        'C — calcium uses only one letter',
      ],
      answer: 0,
      whyWrong: ['CA is wrong capitalization', 'ca is wrong', 'C is carbon'],
    },
    {
      id: `nacl-${v}`,
      bloom: 'apply',
      stem: 'Why is table salt (NaCl) classified as a compound?',
      choices: [
        'It contains sodium and chlorine chemically joined in a fixed ratio',
        'It is white and looks pure',
        'It melts when heated',
        'It is mined at Lake Magadi only',
      ],
      answer: 0,
      whyWrong: ['Appearance ≠ compound', 'Melting can be physical', 'Source location is not the definition'],
    },
    {
      id: `phys-${v}`,
      bloom: 'recall',
      stem: 'Which change is physical?',
      choices: [
        'Ice melting to water',
        'Paper burning to ash',
        'Iron rusting',
        'Baking soda reacting with vinegar to make a new gas',
      ],
      answer: 0,
      whyWrong: ['Burning is chemical', 'Rusting is chemical', 'Gas-forming reaction is chemical'],
    },
    {
      id: `liq-${v}`,
      bloom: 'apply',
      stem: 'Which property of liquids is correct?',
      choices: [
        'Definite volume, no definite shape',
        'Definite shape and definite volume',
        'No definite volume and no mass',
        'Always denser than every solid',
      ],
      answer: 0,
      whyWrong: ['Solids have definite shape', 'Liquids have mass and volume', 'Density order is not absolute that way'],
    },
    {
      id: `fire-${v}`,
      bloom: 'apply',
      stem: 'Why is water unsuitable for a petrol fire?',
      choices: [
        'Water can spread the burning petrol instead of putting it out safely',
        'Water always increases oxygen',
        'Petrol fires have no fuel',
        'Water removes heat too quickly',
      ],
      answer: 0,
      whyWrong: ['Oxygen claim is false', 'Petrol is fuel', 'Cooling claim is not the main hazard'],
      diagram: fireTriangleSvg(),
    },
    {
      id: `diff-${v}`,
      bloom: 'recall',
      stem: 'Diffusion is best described as:',
      choices: [
        'Net movement of particles from high to low concentration',
        'Movement of water only across a membrane',
        'A chemical reaction that forms a precipitate',
        'Heating a solid until it melts',
      ],
      answer: 0,
      whyWrong: ['That is closer to osmosis', 'Not a definition of diffusion', 'Melting is a state change'],
    },
    {
      id: `osm-${v}`,
      bloom: 'apply',
      stem: 'In osmosis, what mainly moves across a selectively permeable membrane?',
      choices: ['Water', 'Sand grains', 'Whole sugar crystals only', 'Electric current'],
      answer: 0,
      whyWrong: ['Sand does not osmose', 'Large crystals do not freely cross', 'Not electricity'],
    },
    {
      id: `mag-${v}`,
      bloom: 'apply',
      stem: `Eyepiece ×${eye} and objective ×${obj}. What is total magnification?`,
      choices: [`×${mag}`, `×${eye + obj}`, `×${eye}`, `×${obj * 2}`],
      answer: 0,
      whyWrong: ['Do not add lens powers', 'Eyepiece alone is incomplete', 'Doubling objective is wrong'],
      working: formatWorking({
        formula: 'Total magnification = eyepiece × objective',
        substitution: `Total = ${eye} × ${obj}`,
        steps: [`Total = ${mag}`],
        finalAnswer: `×${mag}`,
        methodMarks: 'M1 multiply; A1 answer',
      }),
    },
    {
      id: `press-${v}`,
      bloom: 'apply',
      stem: `Calculate pressure when F = ${F} N and A = ${A} m².`,
      choices: [`${P} Pa`, `${F * A} Pa`, `${F + A} Pa`, `${A / F} Pa`],
      answer: 0,
      whyWrong: ['Do not multiply F×A for pressure', 'Do not add', 'Do not invert wrongly'],
      working: formatWorking({
        formula: 'P = F / A',
        substitution: `P = ${F} / ${A}`,
        steps: [`P = ${P}`],
        finalAnswer: `${P} Pa`,
        methodMarks: 'M1 substitute; A1 Pa',
      }),
      diagram: pressureForceAreaSvg({ F, A }),
    },
    {
      id: `energy-${v}`,
      bloom: 'recall',
      stem: 'The main energy chain in a simple torch is:',
      choices: [
        'Chemical → electrical → light (+ heat)',
        'Light → chemical → sound',
        'Sound → nuclear → light',
        'Heat → food → electricity only',
      ],
      answer: 0,
      whyWrong: ['Wrong order', 'Not a torch chain', 'Not a torch chain'],
    },
    {
      id: `fe-${v}`,
      bloom: 'recall',
      stem: 'Iron has symbol Fe from the Latin name:',
      choices: ['Ferrum', 'Natrium', 'Aurum', 'Kalium'],
      answer: 0,
      whyWrong: ['Natrium is sodium', 'Aurum is gold', 'Kalium is potassium'],
    },
  ];
}

function structuredBank(variant) {
  const v = variant % 11;
  const F = 150 + v * 10;
  const A = 0.5;
  return [
    {
      id: `s-el-${v}`,
      marks: 5,
      q: 'Differentiate an element from a compound. Give one Kenyan example of each.',
      a: 'An element is a pure substance of one kind of atom and cannot be broken down chemically/physically into simpler substances (e.g. copper in wires, Fe in a jembe). A compound is made when different elements join chemically in fixed proportions (e.g. NaCl table salt, H₂O).',
    },
    {
      id: `s-phys-${v}`,
      marks: 6,
      q: 'Explain why melting ice is a physical change but burning paper is a chemical change.',
      a: 'Melting ice: still H₂O, no new substance, reversible by freezing → physical. Burning paper: ash/gases form, new substances, not simply reversible → chemical.',
    },
    {
      id: `s-p-${v}`,
      marks: 8,
      q: `A force of ${F} N acts on an area of ${A} m². Calculate the pressure. Show full working.`,
      a: formatWorking({
        formula: 'P = F / A',
        substitution: `P = ${F} / ${A}`,
        steps: [`P = ${F / A}`],
        finalAnswer: `${F / A} Pa`,
        methodMarks: 'M1 formula/substitution; A1 final answer with Pa',
      }),
      diagram: pressureForceAreaSvg({ F, A }),
    },
    {
      id: `s-fire-${v}`,
      marks: 6,
      q: 'Name the three parts of the fire triangle. Explain one safe response to a small cooking-oil fire.',
      a: 'Fuel, heat, oxygen. For oil fires, do not use water; smother/cover to cut oxygen and get help / evacuate if needed.',
      diagram: fireTriangleSvg(),
    },
    {
      id: `s-osm-${v}`,
      marks: 6,
      q: 'Define osmosis and describe what happens to visking tubing with concentrated sugar solution in distilled water.',
      a: 'Osmosis: water moves across a selectively permeable membrane from dilute toward more concentrated solution. Water enters the tubing; it swells/gains mass.',
    },
    {
      id: `s-en-${v}`,
      marks: 5,
      q: 'Trace the energy transformations in a torch from dry cells to the bulb.',
      a: 'Chemical energy (cells) → electrical energy (circuit) → light energy + heat energy (bulb).',
    },
  ];
}

function pickUnique(bank, count, usedIds, offset) {
  const out = [];
  let i = offset;
  let guard = 0;
  while (out.length < count && guard < bank.length * 3) {
    const item = bank[i % bank.length];
    const uid = `${item.id}:${i}`;
    if (!usedIds.has(item.id) || guard > bank.length) {
      out.push({ ...item, uid });
      usedIds.add(item.id);
    }
    i++;
    guard++;
  }
  return out;
}

export function generatePaper({ tier, paperIndex, term = null, usedItems }) {
  const meta = TIER_META[tier];
  const used = usedItems || new Set();
  const mcqs = pickUnique(itemBank(paperIndex), meta.mcq, used, paperIndex * 3);
  const structs = pickUnique(structuredBank(paperIndex), meta.structured, used, paperIndex * 2);

  const paperLines = [
    titleBlock(`${CONFIG.SUBJECT} — ${meta.label}${term ? ` (TERM ${term})` : ''} ${paperIndex + 1}`),
    '',
    `EXAM BODY: ${CONFIG.EXAM_BODY}`,
    `GRADE: ${CONFIG.GRADE}`,
    `TIME ALLOWED: ${meta.time}`,
    `TOTAL MARKS: ${meta.totalMarks}`,
    '',
    sectionBlock('INSTRUCTIONS'),
    '• Answer all questions.',
    '• For calculations, show full working (formula → substitution → steps → final answer with units).',
    '• Diagrams provided are part of the question — use every labeled value.',
    '',
    sectionBlock('SECTION A — MULTIPLE CHOICE'),
  ];

  const markLines = [titleBlock('MARKING SCHEME'), ''];

  mcqs.forEach((q, idx) => {
    const n = idx + 1;
    paperLines.push(`${n}. ${q.stem} (1 mark)`);
    q.choices.forEach((c, i) => paperLines.push(`   ${String.fromCharCode(65 + i)}. ${c}`));
    if (q.diagram) {
      paperLines.push('');
      paperLines.push(q.diagram);
    }
    paperLines.push('');
    markLines.push(`${n}. Correct option: ${String.fromCharCode(65 + q.answer)} — ${q.choices[q.answer]}`);
    if (q.working) {
      markLines.push(q.working);
    }
    markLines.push('');
  });

  paperLines.push(sectionBlock('SECTION B — STRUCTURED QUESTIONS'));
  structs.forEach((q, idx) => {
    const n = mcqs.length + idx + 1;
    paperLines.push(`${n}. ${q.q} (${q.marks} marks)`);
    if (q.diagram) {
      paperLines.push('');
      paperLines.push(q.diagram);
    }
    paperLines.push('');
    markLines.push(`${n}. (${q.marks} marks)`);
    markLines.push(toUnicodeFormula(q.a));
    markLines.push('');
  });

  const paper = paperLines.join('\n');
  const scheme = markLines.join('\n');

  return {
    id: randomUUID(),
    type: meta.type,
    title: `Grade 8 Integrated Science — ${meta.label}${term ? ` Term ${term}` : ''} #${paperIndex + 1}`,
    topic: {
      grade: 'grade-8',
      gradeLabel: 'Grade 8',
      subject: 'INTEGRATED SCIENCE',
      topicNumber: term ? `T${term}` : tier.toLowerCase(),
      topicOrder: paperIndex + 1,
      slug: `g8-is-${tier.toLowerCase()}${term ? `-t${term}` : ''}-${paperIndex + 1}`,
    },
    pages: {
      lesson: '',
      quiz: paper,
      answers: scheme,
      studyPages: [],
    },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: paper.split(/\s+/).length,
      reviewed: true,
      access: meta.access,
      priceKes: meta.priceKes,
      questionCount: mcqs.length + structs.length,
      category: meta.category,
      term: term,
      contentSource: 'study-drama-exam-v1',
      examBody: CONFIG.EXAM_BODY,
      paperTier: tier,
      paperIndex: paperIndex + 1,
      totalMarks: meta.totalMarks,
    },
    sources: [
      {
        id: 'g8-is-curriculum',
        grade: 'grade-8',
        subject: 'INTEGRATED SCIENCE',
        excerpt: 'Grade 8 Integrated Science assessment from study-drama exam engine',
      },
    ],
    _usedItemIds: [...used],
  };
}

export { TIER_META };
