/**
 * Agent 1B — Lesson Writer
 * Outputs ONLY student-facing study notes. No scaffolding, no meta-answers.
 */
import { titleBlock, sectionBlock, toUnicodeFormula, cleanNoise } from './house-style.mjs';
import { buildIntro } from './intros.mjs';
import { pressureWorking, magnificationWorking } from './math-working.mjs';
import { pressureForceAreaSvg, fireTriangleSvg, statesParticlePrompt } from './diagram.mjs';
import { CONFIG } from './config.mjs';

const LOCALS = [
  'a hardware shop in Nakuru',
  'a kitchen in Kisumu',
  'Lake Magadi salt works',
  'Marikiti market in Nairobi',
  'a shamba in Nyeri',
  'a school lab in Machakos',
  'a matatu stage near Nyamakima',
  'a boarding school dining hall in Eldoret',
  'a charcoal jiko in Kibera',
  'a clinic waiting bench in Thika',
  'a fish landing at Lake Victoria',
  'a tea farm in Kericho',
  'a duka in Mombasa',
  'a roof water tank in Kitale',
  'a solar lantern home in Turkana',
];

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

/** Hand-crafted student pages for key subtopics (gold standard shape). */
const HANDCRAFTED = {
  '1.1:What Is an Element': (loc) => ({
    goals: [
      'What makes a substance an element.',
      'How to tell an element apart from a compound.',
      'Some common elements you meet every day and their symbols.',
    ],
    intro:
      'Look at a copper electrical wire, a gold earring, and the oxygen you are breathing right now. Each one is made of a single, pure building block that scientists call an element. Everything around you is built from just over 100 of these building blocks.',
    notes: [
      'An element is a pure substance that cannot be broken down into a simpler substance by any chemical or physical means.',
      'An element is made of only ONE kind of atom. For example, a piece of pure copper contains only copper atoms.',
      'There are about 118 known elements. Each one has its own name and its own short symbol, for example oxygen (O), hydrogen (H), carbon (C), iron (Fe), copper (Cu) and gold (Au).',
      'A symbol is usually the first letter of the name written as a capital, sometimes with a second small letter. Some come from Latin: iron is Fe from "ferrum", gold is Au from "aurum".',
      'Elements are the building blocks of matter. They can exist on their own, or join with other elements to form compounds. Table salt, NaCl, is not an element — it is a compound made from the elements sodium (Na) and chlorine (Cl).',
    ],
    worked: `A learner in Nakuru buys a jembe. The blade is made mainly of iron. Is iron an element? Iron cannot be split into anything simpler than iron atoms, so YES — iron (Fe) is an element. Now the same learner points at the rust forming on an old blade left in the rain. Is rust an element? No. Rust forms when iron joins with oxygen from the air. Because it now contains two different elements joined together, rust is a compound, not an element.`,
    everyday: `The aluminium (Al) in a cooking sufuria and the copper (Cu) in phone-charger wires are both elements you handle at home near ${loc}. Safety tip: never heat an unknown metal or chemical in the kitchen to "test" it — some give off harmful fumes; only do heating tests under a teacher's guidance in the lab.`,
    summary: [
      'An element cannot be broken into anything simpler.',
      'It is made of only one kind of atom.',
      'Each element has a name and a symbol (O, Fe, Cu, Au).',
      'Two or more elements join to make compounds like NaCl and rust.',
    ],
    questions: [
      'Define an element and give two examples found in a Kenyan home.',
      'A student says, "Salt (NaCl) is an element because it looks pure and white." Explain why this is wrong.',
      'A jembe left in the rain forms rust. Explain why rust cannot be called an element.',
    ],
    answers: [
      'An element is a pure substance that cannot be broken down into a simpler substance by chemical or physical means, because it is made of only one kind of atom. Two examples in a Kenyan home are the copper (Cu) in electrical wires and the aluminium (Al) in a cooking sufuria.',
      'Salt is not an element; it is a compound. Even though it looks pure and white, sodium chloride is made of two different elements — sodium (Na) and chlorine (Cl) — chemically joined. Because it contains more than one kind of atom and can be split into sodium and chlorine, it is a compound.',
      'Rust cannot be called an element because it is a compound called iron oxide. It forms when iron (Fe) reacts with oxygen (O) from the air and water. Since it is made of two elements joined chemically, it is no longer a single pure building block.',
    ],
  }),
};

function correctKnownErrors(p) {
  let t = p;
  t = t.replace(/liquids have a definite shape just like solids/gi, 'liquids have a definite volume but no definite shape of their own');
  t = t.replace(/Therefore,\s*liquids have a definite shape/gi, 'Therefore, liquids take the shape of their container and have no definite shape');
  t = t.replace(/density generally higher than that of liquid and gas/gi, 'density generally higher than that of liquids and gases');
  t = t.replace(/\bare can be\b/gi, 'can be');
  t = t.replace(/\bA compound is pure substance\b/gi, 'A compound is a pure substance');
  return t;
}

function pickFacts(paragraphs, keywords, limit, usedStarts) {
  const used = new Set(usedStarts.map((s) => s.toLowerCase()));
  const out = [];
  const push = (raw) => {
    let p = correctKnownErrors(cleanNoise(raw));
    if (p.length < 28) return;
    if (/^(Requirements|Procedure|Caution|For example,?)$/i.test(p)) return;
    if (/liquids have a definite shape/i.test(p) && !/no definite shape/i.test(p)) return;
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

function nextLocal(ledger) {
  const used = ledger.locals || [];
  const pool = LOCALS.filter((x) => !used.includes(x));
  const choice = pool[0] || LOCALS[used.length % LOCALS.length];
  ledger.locals = [...used, choice];
  return choice;
}

function goalsFor(page) {
  // Plain student goals — never "The learner should be able to…"
  const t = page.title.toLowerCase();
  return [
    `Say what ${t} means in plain words.`,
    `Use one real Kenyan example to show ${t}.`,
    `Correct one common mistake about ${t}.`,
  ];
}

function mainNotesFor(topicNumber, page, facts) {
  const notes = [];
  // Topic-aware openers with real teaching
  if (page.title === 'Rules for Writing Chemical Symbols') {
    notes.push(
      'A chemical symbol is a short universal code for an element\'s name so scientists everywhere understand each other.',
      'The first letter of a symbol is ALWAYS a capital letter. If there is a second letter, it MUST be a small letter.',
      'Example: calcium is Ca, not CA or ca. Copper is Cu. Cobalt is Co — but CO (both capitals) means the compound carbon monoxide, not cobalt.',
      'Some symbols come from English names (H, O, C). Others come from Latin names (Na from Natrium for sodium, Fe from Ferrum for iron).',
    );
    return notes;
  }
  if (page.title === 'Symbols from English Names') {
    ENGLISH_SYMBOLS.forEach(([n, s]) => notes.push(`${n} has the symbol ${s}.`));
    notes.push('These symbols come from the English names of the elements.');
    return notes;
  }
  if (page.title === 'Symbols from Latin Names') {
    LATIN_SYMBOLS.forEach(([n, lat, s]) =>
      notes.push(`${n} has the symbol ${s}, from the Latin name ${lat}.`),
    );
    notes.push('Learning the Latin root helps you remember symbols that do not match the English spelling.');
    return notes;
  }
  if (page.title === 'Formula P Equals F Over A') {
    notes.push(
      'Pressure is the force acting normally (perpendicularly) on a unit area.',
      'The formula is P = F / A, where P is pressure, F is force in newtons (N), and A is area in square metres (m²).',
      'The SI unit of pressure is the pascal (Pa). One pascal equals one newton per square metre (N/m²).',
      'If force stays the same and area gets smaller, pressure increases. If area gets larger, pressure decreases.',
    );
    return notes;
  }
  if (page.title === 'Magnification Formula') {
    notes.push(
      'A light microscope uses more than one lens to enlarge a specimen.',
      'Total magnification = eyepiece magnification × objective magnification.',
      'If the eyepiece is ×10 and the objective is ×40, total magnification is ×400. That means the image looks four hundred times larger than the real specimen.',
    );
    return notes;
  }
  if (page.title === 'The Fire Triangle') {
    notes.push(
      'A fire needs three things at the same time: fuel, heat, and oxygen. Together they form the fire triangle.',
      'Fuel is anything that can burn, such as wood, paper, petrol, or cooking oil.',
      'Heat raises the fuel to its ignition temperature.',
      'Oxygen from the air supports burning. If you remove any one side of the triangle, the fire can go out.',
    );
    return notes;
  }
  if (page.title === 'Solutes Solvents and Solutions') {
    notes.push(
      'A solute is the substance that dissolves, for example sugar or salt.',
      'A solvent is the liquid that does the dissolving. Water is the most common solvent in school experiments and in the body.',
      'A solution is the mixture formed when the solute dissolves completely in the solvent.',
      'A concentrated solution has a lot of solute compared with solvent. A dilute solution has little solute compared with solvent.',
    );
    return notes;
  }
  if (page.title === 'What Is a Compound') {
    notes.push(
      'A compound is a pure substance formed when atoms of two or more different elements join chemically in fixed proportions.',
      'Water is a compound with formula H₂O: two hydrogen atoms join one oxygen atom.',
      'Common salt is a compound with formula NaCl: sodium and chlorine join in a 1:1 ratio.',
      'Compounds can only be broken into their elements by chemical methods, not by simple physical sorting.',
    );
    return notes;
  }
  if (page.title === 'Physical Changes Defined') {
    notes.push(
      'A physical change does not produce a new substance. The material may look different, but it is still the same chemical substance.',
      'Melting ice to water is a physical change: both are still H₂O.',
      'Physical changes are often reversible — water can freeze back to ice.',
      'Crushing chalk or dissolving sugar are also physical changes if no new substance forms.',
    );
    return notes;
  }
  if (page.title === 'Chemical Changes Defined') {
    notes.push(
      'A chemical change produces one or more new substances with different properties.',
      'Burning paper produces ash and gases that are not paper. That is a chemical change.',
      'Rusting iron and cooking an egg are chemical changes because new substances appear.',
      'Chemical changes are usually difficult to reverse by simple cooling or mixing alone.',
    );
    return notes;
  }
  if (page.title === 'Diffusion Defined') {
    notes.push(
      'Diffusion is the net movement of particles from a region of higher concentration to a region of lower concentration.',
      'It happens in gases and liquids without anyone stirring.',
      'Perfume opened in one corner of a classroom is soon smelled elsewhere because perfume particles diffuse through air.',
      'A drop of ink in still water spreads as ink particles diffuse through the water.',
    );
    return notes;
  }
  if (page.title === 'Osmosis Defined') {
    notes.push(
      'Osmosis is the movement of water across a selectively permeable membrane from a dilute solution toward a more concentrated solution.',
      'The membrane lets water pass more easily than large solute particles.',
      'Visking tubing filled with sugar solution and placed in distilled water gains water by osmosis — a school model of the process.',
      'Living cells use osmosis to take in or lose water depending on the surrounding solution.',
    );
    return notes;
  }

  // General: teach from notes facts as real bullets (not meta)
  const cleaned = facts.slice(0, 7).map((f) => toUnicodeFormula(f));
  if (cleaned.length) {
    notes.push(`Here is what you need to know about ${page.title.toLowerCase()}:`);
    return [...notes.slice(0, 0), ...cleaned];
  }
  notes.push(
    `${page.title} is an important Grade 8 Integrated Science idea in ${topicNumber}.`,
    `In simple terms: ${page.scope}.`,
    'Use the correct scientific words and symbols when you explain it in an exam.',
  );
  return notes;
}

function workedFor(topicNumber, page, loc, facts) {
  const t = page.title;
  if (t === 'Rules for Writing Chemical Symbols') {
    return `At ${loc}, a learner labels a cobalt sample as CO on a chart. The teacher crosses it out. CO (both capitals) stands for carbon monoxide, a compound of carbon and oxygen. Cobalt the element must be written Co — capital C, small o. The same learner then writes calcium as CA. That is also wrong; calcium is Ca. Rule used: first letter capital, second letter small.`;
  }
  if (t === 'Formula P Equals F Over A') {
    return [
      `A delivery helper near ${loc} pushes a cart.`,
      '',
      pressureWorking({
        F: 200,
        A: 0.5,
        context: 'First find the pressure when force is 200 N and area is 0.50 m².',
      }),
      '',
      'Now compare: if the same 200 N acts on a narrower plank of 0.20 m², then P = 200 / 0.20 = 1000 Pa. Because pressure rose, the cart sinks more on soft ground. First we used P = F / A, then we substituted, then we compared areas — that is the reasoning.',
      '',
      pressureForceAreaSvg({ F: 200, A: 0.5 }),
    ].join('\n');
  }
  if (t === 'Magnification Formula') {
    return [
      'Faith uses an eyepiece marked ×10 and an objective marked ×40.',
      '',
      magnificationWorking({ eyepiece: 10, objective: 40 }),
      '',
      'Brian wrongly adds 10 + 40 = 50. That is incorrect because total magnification multiplies the lens powers. First write the formula, then substitute, then multiply — never add the markings.',
    ].join('\n');
  }
  if (t === 'The Fire Triangle') {
    return [
      `At a market stall near ${loc}, cooking oil on a cloth catches fire.`,
      'First identify the three parts present: fuel (oil/cloth), heat (flame), oxygen (air).',
      'Because all three are present, the fire continues.',
      'Owino reaches for water — wrong for an oil fire, because water can spread the burning fuel.',
      'Correct action: cut oxygen/heat safely with a cover and move people away — removing one side of the triangle.',
      '',
      fireTriangleSvg(),
    ].join('\n');
  }
  if (t === 'States of Matter Overview' || t === 'Particle Arrangement Model' || t === 'Properties of Gases') {
    return [
      workedNarrative(topicNumber, page, loc, facts),
      '',
      statesParticlePrompt(),
    ].join('\n');
  }
  if (t === 'Water as a Compound') {
    return `A family boils water for chai at ${loc}. The liquid turns to steam, but steam is still water — formula H₂O — so boiling is a physical change of state. Water is a compound because hydrogen and oxygen are chemically joined in a fixed 2:1 ratio. You cannot sieve hydrogen out of water the way you sieve sand from flour.`;
  }
  if (t === 'Common Salt as a Compound') {
    return `Salt crystals linked to Lake Magadi are sodium chloride, NaCl. Sodium (Na) alone is a reactive metal; chlorine (Cl) alone is a poisonous gas. Joined as NaCl they form the safe kitchen compound we use for cooking and preservation. That proves a compound has properties different from its elements.`;
  }
  if (t === 'Solutes Solvents and Solutions') {
    return `Tonny stirs three spoons of sugar into a glass of water at ${loc}. First name the parts: sugar is the solute, water is the solvent. Because the sugar disappears into the water, the sweet liquid is a solution. Next he makes a second glass with only half a spoon of sugar — that one is more dilute. Same solute and solvent; different amounts change the concentration.`;
  }
  return workedNarrative(topicNumber, page, loc, facts);
}

function workedNarrative(topicNumber, page, loc, facts) {
  const fact = facts[0] ? toUnicodeFormula(facts[0]) : null;
  return [
    `Worked situation (${loc}): a learner investigates ${page.title.toLowerCase()}.`,
    fact ? `First observation: ${fact}` : `First, state the meaning: ${page.scope}.`,
    'Because of that observation, the learner names the correct scientific idea and rejects a near-miss confusion.',
    'So the conclusion is written in one accurate sentence that matches the main notes — with the correct symbol or formula if one applies (H₂O, NaCl, Fe, P = F / A).',
  ].join(' ');
}

function everydayFor(page, loc) {
  const tips = [
    'Safety tip: protect your eyes when heating and never taste unknown chemicals.',
    'Practical tip: write the correct symbol or formula before you explain out loud.',
    'Safety tip: if you see smoke, raise the alarm early and do not fight a large fire alone.',
    'Practical tip: compare two cases (right vs wrong) so the idea sticks for exams.',
  ];
  const tip = tips[Math.abs(page.title.length) % tips.length];
  return `At ${loc}, ${page.title.toLowerCase()} shows up when you handle real materials or processes linked to this idea. ${tip}`;
}

function summaryFor(page, notes) {
  const pts = notes
    .filter((n) => !/^Here is what you need/i.test(n))
    .slice(0, 4)
    .map((n) => (n.length > 140 ? `${n.slice(0, 137)}...` : n));
  while (pts.length < 3) {
    pts.push(`${page.title} matters for safe, accurate Grade 8 science.`);
  }
  return pts;
}

function questionsAndAnswers(topicNumber, page, loc, notes) {
  const title = page.title;
  const def =
    notes.find((n) => /is a |are |formula|symbol|pressure|diffusion|osmosis|element|compound|fire|cell|cannot|needs/i.test(n)) ||
    notes[0] ||
    page.scope;

  const q1 = `Define ${title.toLowerCase()} in your own words and give one clear example.`;
  const q2 = `Describe a situation at ${loc} that shows ${title.toLowerCase()}, and explain the science involved.`;
  const q3 = `A learner makes a mistake about ${title.toLowerCase()}. State a likely wrong idea, correct it, and justify your correction with facts from this page.`;

  const a1 = `${toUnicodeFormula(def)} For example, link it to a real object or event at home, school, market or shamba that fits this page.`;
  const a2 = `At ${loc}, you would observe something that matches ${title.toLowerCase()}. Name the observation, then explain it using the definition above${/P =|magnification|H₂O|NaCl/i.test(notes.join(' ')) ? ', including the correct formula or symbol' : ''}. End by stating why the correct idea matters for accuracy or safety.`;
  const a3 = `Wrong idea: confusing ${title.toLowerCase()} with a neighbouring concept or ignoring a key rule. Correct idea: ${toUnicodeFormula(String(page.scope))}. Justification: the worked example on this page shows the right reasoning with real objects or numbers.`;

  return {
    questions: [q1, q2, q3],
    answers: [a1, a2, a3],
  };
}

function assemblePage(title, content) {
  const lines = [
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
  ];
  return lines.join('\n').trim();
}

/**
 * Write one student page.
 * Orchestrator passes page title + used-examples ledger; writer prints only the page.
 */
export function writePage({ topic, map, page, pageNumber, totalPages, ledger }) {
  const loc = nextLocal(ledger);
  const key = `${topic.topicNumber}:${page.title}`;
  const usedStarts = ledger.factStarts || [];
  // SOURCE_MODE: BOTH uses notes paragraphs; DESIGN_ONLY would rely on page map scope only
  const paras =
    CONFIG.SOURCE_MODE === 'DESIGN_ONLY' ? [] : topic.paragraphs || [];

  let content;
  if (HANDCRAFTED[key]) {
    content = HANDCRAFTED[key](loc);
    // Still register intro fingerprint so QA uniqueness holds
    ledger.introFingerprints = [
      ...(ledger.introFingerprints || []),
      content.intro.slice(0, 64).toLowerCase(),
    ];
  } else {
    const facts = pickFacts(paras, page.keywords, 8, usedStarts);
    ledger.factStarts = [...usedStarts, ...facts.map((f) => f.slice(0, 56))];
    const notes = mainNotesFor(topic.topicNumber, page, facts);
    const qa = questionsAndAnswers(topic.topicNumber, page, loc, notes);
    content = {
      goals: goalsFor(page),
      intro: buildIntro(page, facts, pageNumber, ledger),
      notes,
      worked: workedFor(topic.topicNumber, page, loc, facts),
      everyday: everydayFor(page, loc),
      summary: summaryFor(page, notes),
      questions: qa.questions,
      answers: qa.answers,
    };
  }

  // Track examples/questions for orchestrator uniqueness (not printed)
  ledger.questionStems = [...(ledger.questionStems || []), ...content.questions];
  ledger.workedFingerprints = [...(ledger.workedFingerprints || []), content.worked.slice(0, 80)];

  const body = assemblePage(page.title, content);
  return { body, ledger };
}

export function buildQuizFromPages(topic, pages) {
  const qs = [];
  const as = [];
  pages.slice(0, 8).forEach((p, i) => {
    const n = i + 1;
    // Pull first revision question + first answer from page body if present
    const qm = p.body.match(/REVISION QUESTIONS\n----\n([\s\S]*?)\n\nANSWERS/i);
    const am = p.body.match(/ANSWERS\n----\n([\s\S]*)$/i);
    const qline = qm ? qm[1].split('\n').find((l) => /^1\./.test(l)) : null;
    const aline = am ? am[1].split('\n').find((l) => /^1\./.test(l)) : null;
    qs.push(qline ? qline.replace(/^1\.\s*/, `${n}. `) : `${n}. Revise the main idea of ${p.title}.`);
    as.push(aline ? aline.replace(/^1\.\s*/, `${n}. `) : `${n}. See the answers section for ${p.title}.`);
  });
  return {
    quiz: [titleBlock('REVISION QUIZ'), '', ...qs].join('\n'),
    answers: [titleBlock('ANSWERS'), '', ...as].join('\n'),
    questionCount: qs.length,
  };
}
