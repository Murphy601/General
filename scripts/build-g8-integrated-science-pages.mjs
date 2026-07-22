#!/usr/bin/env node
/**
 * Grade 8 Integrated Science — MULTI-PAGE STUDENT TEXTBOOK MODULES
 *
 * Follows knowledge-base/prompts/student-textbook-module.md
 * - Student textbook voice only (no teacher meta)
 * - Dense multi-page modules from uploaded notes
 * - Page anatomy: Concept → Worked example → Visual → Application → Practice + Solutions
 *
 * Usage:
 *   node scripts/build-g8-integrated-science-pages.mjs
 *   node scripts/build-g8-integrated-science-pages.mjs --lock --free-pages 3
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

const BANNED =
  /\b(today'?s idea|today we study|today we will|tell students|guide the learner|in this lesson|your turn|expected answers|lesson plan|scheme of work|teacher'?s guide|check yourself|try this:)\b/i;

function clean(s) {
  return String(s || '')
    .replace(/[\u00a0]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bcompunds\b/gi, 'compounds')
    .replace(/\bflouride\b/gi, 'fluoride')
    .replace(/\bsort -hand\b/gi, 'shorthand')
    .replace(/\bration\b/gi, 'ratio')
    .replace(/\bgoogles\b/gi, 'goggles')
    .replace(/\bare can be\b/gi, 'can be')
    .replace(/\bcan be element and compounds\b/gi, 'can be elements or compounds')
    .replace(/\bA compound is pure substance\b/gi, 'A compound is a pure substance')
    .replace(/\blearner(s)?\b/gi, (m) => (/s$/i.test(m) ? 'you' : 'you'))
    .trim();
}

function isNoise(line) {
  const t = clean(line);
  if (!t || t.length < 2) return true;
  if (/^GRADE\s*\d+|LESSON NOTES|RATIONALIZED|^STRAND\s*\d/i.test(t)) return true;
  if (/^\d+$/.test(t)) return true;
  if (
    /^(Name of element|Chemical symbol|Latin name\.?|Volume|Density|Shape|Ability to flow|Compressibility|State of matter|Mineral element of compound|Examples of food sources|Objective lens magnification|Eyepiece lens magnification|Total magnification\.?)$/i.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

function isHeading(line, topic) {
  const raw = clean(line);
  const t = raw.replace(/:$/, '');
  if (!t || t.length < 4 || t.length > 100) return false;
  if (isNoise(t)) return false;
  if (/^(Requirements|Procedure|Procedures|Caution|Observation|For example)\.?$/i.test(t)) return false;
  if (/^\d+\.\d+\b/.test(t)) return true;
  if (t.toLowerCase() === String(topic.topicName || '').toLowerCase()) return true;
  if (
    /^(Meaning of|Relating common|Application of|Applications of|Importance of|Properties of|Summary of|Pure and Impure|Diffusion and Osmosis|Pressure in|Meaning of pressure|Classes of|Safety measures|Forms of energy|Information on Packaging|Examples of food nutrients|The cell membrane|In plants Osmosis|In animals|Movement of|Reproduction|Transformation of|Physical changes|Chemical changes|Calculating the|Magnification of|Plant cells|Animal cells|Solutes and solvent|Concentration\.?$|DIFFUSION\.?$|OSMOSIS\.?$|The symbols of some elements)/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/^(Gold|Silver|Iron):$/i.test(raw)) return true;
  if (t === t.toUpperCase() && /[A-Z]/.test(t) && t.split(/\s+/).length >= 2 && t.split(/\s+/).length <= 10) {
    return true;
  }
  if (/:$/.test(raw) && t.length >= 18 && t.length < 80) return true;
  return false;
}

function shortTitle(title) {
  let t = clean(title)
    .replace(/\s*\(\d+\/\d+\)\s*$/g, '')
    .replace(/\s*\((?:a|b)\)\s*$/i, '')
    .replace(/\.$/, '')
    .trim();
  const map = [
    [/meaning of atoms.*/i, 'Atoms, Elements and Compounds'],
    [/relating common elements.*/i, 'Chemical Symbols of Elements'],
    [/symbols of some elements derived from english.*/i, 'Symbols from English Names'],
    [/symbols of some elements derived from latin.*/i, 'Symbols from Latin Names'],
    [/application of common elements.*/i, 'Elements in Daily Life'],
    [/important mineral elements.*/i, 'Mineral Elements for Plants'],
    [/information on packaging.*/i, 'Reading Packaging Labels'],
    [/properties of different states.*/i, 'Properties of Solids, Liquids and Gases'],
    [/summary of properties.*/i, 'Summary Table of States of Matter'],
    [/pure and impure.*/i, 'Pure and Impure Substances'],
    [/physical changes.*/i, 'Physical Changes'],
    [/chemical changes.*/i, 'Chemical Changes'],
    [/applications of changes.*/i, 'Changes of State in Daily Life'],
    [/classes of fire.*/i, 'Classes of Fire'],
    [/diffusion.*/i, 'Diffusion'],
    [/osmosis experiment.*/i, 'Osmosis Experiment'],
    [/experiment to demonstrate osmosis.*/i, 'Osmosis Experiment'],
    [/the cell membrane.*/i, 'The Cell Membrane and Osmosis'],
    [/in plants osmosis.*/i, 'Osmosis in Plants'],
    [/in animals,? osmosis.*/i, 'Osmosis in Animals'],
    [/solutes and solvent.*/i, 'Solutes, Solvents and Solutions'],
    [/concentration.*/i, 'Concentrated and Dilute Solutions'],
    [/meaning of pressure.*/i, 'Meaning of Pressure'],
    [/pressure in liquids.*/i, 'Pressure in Liquids'],
    [/mathematical terms, pressure.*/i, 'Calculating Pressure'],
    [/applications of pressure in solids.*/i, 'Pressure in Solids — Applications'],
    [/application of pressure in liquids.*/i, 'Pressure in Liquids — Applications'],
    [/forms of energy.*/i, 'Forms of Energy'],
    [/transformation of energy.*/i, 'Transformation of Energy'],
    [/safety measures.*/i, 'Safety with Energy Transformations'],
    [/magnification.*/i, 'Magnification of Cells'],
    [/the cell.*/i, 'The Cell'],
    [/reproduction.*/i, 'Human Reproduction'],
    [/^gold$/i, 'Importance of Gold'],
    [/^silver$/i, 'Importance of Silver'],
    [/^iron$/i, 'Importance of Iron'],
  ];
  for (const [rx, nice] of map) if (rx.test(t)) return nice;
  return t;
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
  const out = [];
  for (const s of sections) {
    if (out.length && s.lines.join(' ').length < 160) out[out.length - 1].lines.push(...s.lines);
    else out.push(s);
  }
  return out;
}

function paginate(lines, target = 700, max = 1100) {
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
    if (buf.length && n + line.length > max) flush();
    buf.push(line);
    n += line.length + 1;
    if (n >= target) flush();
  }
  flush();
  return pages.length ? pages : [lines];
}

function normalizePairs(lines) {
  const out = [];
  const latinish = (x) => /^[A-Za-z][a-z]+$/.test(x);
  const symbolish = (x) => /^[A-Z][a-z]?$/.test(x) && x.length <= 2;
  for (let i = 0; i < lines.length; i += 1) {
    const a = clean(lines[i]);
    const b = clean(lines[i + 1] || '');
    const c = clean(lines[i + 2] || '');
    if (/^[A-Z][a-z]+$/.test(a) && latinish(b) && symbolish(c)) {
      out.push(`${a} (Latin: ${b.charAt(0).toUpperCase()}${b.slice(1)}) is written ${c}.`);
      i += 2;
      continue;
    }
    if (/^[A-Z][a-z]+$/.test(a) && symbolish(b)) {
      out.push(`${a} is written ${b}.`);
      i += 1;
      continue;
    }
    if (
      /^(Carbon|Nitrogen|Fluoride|Calcium|Copper|Iron|Magnesium|Phosphorus|Potassium|Sodium chloride)$/i.test(a) &&
      b.length > 10
    ) {
      out.push(`${a} is commonly found in ${b}`);
      i += 1;
      continue;
    }
    if (/^(Requirements|Procedure|Procedures|Caution)\s*:?\s*$/i.test(a)) continue;
    out.push(lines[i]);
  }
  return out.map(clean).filter(Boolean);
}

function proseFromFacts(facts, title) {
  const f = facts.map(clean).filter((x) => x.length > 12);
  if (!f.length) {
    return `${shortTitle(title)} is an important idea in Grade 8 Integrated Science. Read the explanations and examples carefully, then attempt the practice questions at the end of this page.`;
  }
  const p1 = [];
  const p2 = [];
  const p3 = [];
  f.forEach((line, i) => {
    const s = /[.!?]$/.test(line) ? line : `${line}.`;
    if (i < Math.ceil(f.length * 0.35)) p1.push(s);
    else if (i < Math.ceil(f.length * 0.7)) p2.push(s);
    else p3.push(s);
  });
  const join = (arr) => arr.join(' ').replace(/\.\s*\./g, '.').replace(/\s+/g, ' ').trim();
  const blocks = [join(p1), join(p2), join(p3)].filter((b) => b.length > 40);
  // Ensure textbook density: expand short clusters
  return blocks
    .map((b, idx) => {
      if (b.split(/\s+/).length >= 45) return b;
      if (idx === 0) {
        return `${b} Understanding this clearly helps you explain the science behind things you see at home, in school, and outdoors in Kenya.`;
      }
      if (idx === 1) {
        return `${b} Keep the definitions precise, and notice how each idea connects to the example that follows.`;
      }
      return `${b} Use the practice questions to test whether you can apply the idea, not only recall the wording.`;
    })
    .join('\n\n');
}

function visualFor(topic, title, facts) {
  const key = `${topic.topicName} ${title}`.toLowerCase();
  // Element / compound pages (including atoms and symbols)
  if (/atom|element|compound|symbol|latin|nacl|h2o/.test(key + ' ' + facts.join(' ').toLowerCase()) && !/pressure|diffusion|osmosis|fire class|transformation of energy/.test(key)) {
    return [
      '### Visual model — atoms, elements and symbols',
      '',
      '| Element | Symbol | Note |',
      '|---|---|---|',
      '| Hydrogen | H | From English name |',
      '| Oxygen | O | From English name |',
      '| Sodium | Na | From Latin *Natrium* |',
      '| Iron | Fe | From Latin *Ferrum* |',
      '| Gold | Au | From Latin *Aurum* |',
      '',
      '```text',
      '  Atom (smallest unit of an element)',
      '     |',
      '     +--> many same atoms  => element sample',
      '     +--> different atoms joined chemically => compound (e.g. NaCl, H2O)',
      '```',
    ].join('\n');
  }
  if (/solid|liquid|gas|states of matter|compress/.test(key)) {
    return [
      '### Visual model — particle arrangement',
      '',
      '```text',
      ' SOLID                 LIQUID                GAS',
      ' ● ● ●                 ●  ●                  ●     ●',
      ' ● ● ●                  ● ● ●                   ●',
      ' ● ● ●                 ●   ●              ●         ●',
      ' closely packed        close but move       far apart,',
      ' vibrate in place      and slide            move freely',
      '```',
      '',
      '| Property | Solid | Liquid | Gas |',
      '|---|---|---|---|',
      '| Shape | Definite | Takes container shape | Takes container shape |',
      '| Volume | Fixed | Fixed | Not fixed |',
      '| Compressibility | Almost none | Very little | High |',
      '| Flow | Does not flow | Flows | Flows |',
    ].join('\n');
  }
  if (/diffusion|osmosis|solute|solvent|concentration|membrane/.test(key)) {
    return [
      '### Visual model — particle movement',
      '',
      '```text',
      ' DIFFUSION (e.g. perfume in air / dye in water)',
      ' High concentration  ----->  Low concentration',
      ' ●●●●●●●●●                 ● ● ● ● ●',
      '',
      ' OSMOSIS (water across a selectively permeable membrane)',
      ' Dilute side | membrane | Concentrated side',
      '  many H2O   |    >>>   |   fewer free H2O',
      '```',
      '',
      '| Process | What moves | Medium | Needs membrane? |',
      '|---|---|---|---|',
      '| Diffusion | Particles of solute/gas | Gas, liquid (sometimes solid) | No |',
      '| Osmosis | Water (solvent) | Liquid | Yes (selectively permeable) |',
    ].join('\n');
  }
  if (/pressure|force|pascal|Pascal|F\/A|hρg/.test(key + facts.join(' '))) {
    return [
      '### Visual model — pressure',
      '',
      '```text',
      '        Force (F)',
      '           ↓↓↓',
      '    +--------------+',
      '    |//////////////|  <- contact area (A)',
      '    +--------------+',
      ' Pressure P = F / A',
      ' Same force, smaller A => larger P',
      '```',
      '',
      '| Quantity | Symbol | SI unit |',
      '|---|---|---|',
      '| Force | F | newton (N) |',
      '| Area | A | square metre (m²) |',
      '| Pressure | P | N/m² = pascal (Pa) |',
      '| Liquid pressure | P = hρg | also Pa |',
    ].join('\n');
  }
  if (/fire|class a|class b|oxygen|fuel|heat/.test(key)) {
    return [
      '### Visual model — fire triangle',
      '',
      '```text',
      '          HEAT',
      '           /\\',
      '          /  \\',
      '         /    \\',
      '        /______\\',
      '     FUEL      OXYGEN',
      '',
      ' Remove any one side => fire goes out',
      '```',
      '',
      '| Class | Typical fuel | Usual approach |',
      '|---|---|---|',
      '| A | Wood, paper, cloth | Cool with water (where safe) |',
      '| B | Petrol, oils, paints | Smother / correct extinguisher — not water |',
      '| C | Electrical equipment | Cut power, correct extinguisher |',
    ].join('\n');
  }
  if (/cell|chloroplast|magnification|organelle/.test(key)) {
    return [
      '### Visual model — plant cell (simplified)',
      '',
      '```text',
      ' +---------------------------+',
      ' | cell wall                 |',
      ' |  +---------------------+  |',
      ' |  | cell membrane       |  |',
      ' |  |   cytoplasm         |  |',
      ' |  |   [nucleus]         |  |',
      ' |  |   (chloroplast)*    |  |',
      ' |  +---------------------+  |',
      ' +---------------------------+',
      ' * chloroplasts in plant cells (photosynthesis)',
      '```',
      '',
      '| Lens | Example power | Role |',
      '|---|---|---|',
      '| Eyepiece | ×10 | Near the eye |',
      '| Objective | ×4, ×10, ×40 | Near the specimen |',
      '| Total magnification | eyepiece × objective | Final image size |',
    ].join('\n');
  }
  if (/energy|kinetic|potential|electrical|chemical/.test(key)) {
    return [
      '### Visual model — energy transformation chain',
      '',
      '```text',
      ' Chemical energy (dry cell)',
      '        |',
      '        v',
      ' Electrical energy (current in wires)',
      '        |',
      '        v',
      ' Light energy + Heat energy (bulb)',
      '```',
      '',
      '| Form | Everyday example in Kenya |',
      '|---|---|',
      '| Chemical | Food, charcoal, dry cell |',
      '| Electrical | Socket, solar home system |',
      '| Kinetic | Moving boda boda / flowing water |',
      '| Light | Sunlight, bulb, phone torch |',
    ].join('\n');
  }
  return [
    '### Visual model',
    '',
    '```text',
    ` Topic focus: ${shortTitle(title)}`,
    ' Read the concept text, then match each key term to an example you know.',
    '```',
  ].join('\n');
}

function workedExample(topic, title, facts) {
  const text = facts.join(' ');
  const key = `${topic.topicName} ${title}`.toLowerCase();
  const lines = ['### Worked example', ''];

  if (/pressure|pascal|F\/A|force/.test(key + text) && /area|force|pressure/i.test(text)) {
    lines.push('A wooden block weighs $200\\,\\text{N}$ and rests on an area of $0.50\\,\\text{m}^2$. Find the pressure on the ground.');
    lines.push('');
    lines.push('**Step 1 — State the formula**');
    lines.push('');
    lines.push('$$P = \\frac{F}{A}$$');
    lines.push('');
    lines.push('**Step 2 — Identify quantities**');
    lines.push('');
    lines.push('- $F = 200\\,\\text{N}$');
    lines.push('- $A = 0.50\\,\\text{m}^2$');
    lines.push('');
    lines.push('**Step 3 — Substitute**');
    lines.push('');
    lines.push('$$P = \\frac{200}{0.50} = 400\\,\\text{N/m}^2 = 400\\,\\text{Pa}$$');
    lines.push('');
    lines.push('**Interpretation:** The ground experiences a pressure of $400\\,\\text{Pa}$. If the same force acted on a smaller area, pressure would increase.');
    return lines.join('\n');
  }

  if (/magnification|eyepiece|objective/.test(key + text)) {
    lines.push('A light microscope has an eyepiece of $\\times 10$ and an objective of $\\times 40$. Calculate total magnification.');
    lines.push('');
    lines.push('**Formula:** Total magnification = eyepiece magnification $\\times$ objective magnification');
    lines.push('');
    lines.push('$$10 \\times 40 = \\times 400$$');
    lines.push('');
    lines.push('The specimen appears 400 times larger than its actual size.');
    return lines.join('\n');
  }

  if (/symbol|compound|element|formula|nacl|h2o/.test(key + text)) {
    lines.push('Sodium and chlorine combine chemically to form common salt.');
    lines.push('');
    lines.push('- Sodium is an **element** with symbol $\\text{Na}$ (from Latin *Natrium*).');
    lines.push('- Chlorine is an **element** with symbol $\\text{Cl}$.');
    lines.push('- The compound formed is sodium chloride, formula $\\text{NaCl}$, ratio $1:1$.');
    lines.push('- Water is another compound: hydrogen and oxygen in ratio $2:1$, formula $\\text{H}_2\\text{O}$.');
    lines.push('');
    lines.push('**Rule:** The first letter of a chemical symbol is always a capital letter; any second letter is small (for example $\\text{Ca}$, $\\text{Cu}$, $\\text{Cl}$).');
    return lines.join('\n');
  }

  if (/diffusion/.test(key + text) && !/osmosis/.test(title.toLowerCase())) {
    lines.push('When perfume is opened in one corner of a classroom, learners in other corners eventually smell it.');
    lines.push('');
    lines.push('1. Perfume particles are concentrated near the bottle.');
    lines.push('2. They move randomly into spaces where fewer perfume particles exist.');
    lines.push('3. This net movement from high to low concentration is **diffusion**.');
    lines.push('4. The smell spreads without anyone “pushing” the air deliberately.');
    return lines.join('\n');
  }

  if (/osmosis|membrane/.test(key + text)) {
    lines.push('A visking tubing bag containing a concentrated sugar solution is placed in a beaker of distilled water.');
    lines.push('');
    lines.push('1. The tubing acts like a selectively permeable membrane.');
    lines.push('2. Water molecules are more free to move on the distilled-water side.');
    lines.push('3. Water moves into the tubing by **osmosis**.');
    lines.push('4. The tubing becomes firmer/swollen as water enters.');
    lines.push('');
    lines.push('This models how water can enter living cells when the surroundings are more dilute.');
    return lines.join('\n');
  }

  if (/fire/.test(key)) {
    lines.push('A waste-paper fire starts in a dustbin (Class A fuel: paper).');
    lines.push('');
    lines.push('1. Identify the fire class from the material burning.');
    lines.push('2. Class A fires can often be cooled with water because water removes heat.');
    lines.push('3. If the fire involved petrol instead (Class B), water would be unsafe — fuel can float and spread.');
    lines.push('4. Always connect the method to the fire triangle: remove heat, fuel, or oxygen.');
    return lines.join('\n');
  }

  if (/physical|chemical|state of matter|solid|melting/.test(key + text)) {
    lines.push('Compare melting ice with burning paper.');
    lines.push('');
    lines.push('| Situation | Type of change | Evidence |');
    lines.push('|---|---|---|');
    lines.push('| Ice → water | Physical | Still water (H₂O); can freeze back |');
    lines.push('| Paper burns | Chemical | New substances (ash, gases); paper not recovered |');
    lines.push('');
    lines.push('Physical changes rearrange appearance/state; chemical changes produce new substances.');
    return lines.join('\n');
  }

  if (/energy|transform/.test(key + text)) {
    lines.push('A torch uses a dry cell to light a bulb.');
    lines.push('');
    lines.push('1. The dry cell stores **chemical energy**.');
    lines.push('2. When the switch is closed, chemical energy changes to **electrical energy**.');
    lines.push('3. In the bulb, electrical energy changes mainly to **light energy** (and some heat).');
    lines.push('');
    lines.push('Chain: chemical → electrical → light (+ heat).');
    return lines.join('\n');
  }

  // Generic conceptual worked example from strongest fact
  const def = facts.find((x) => x.length > 40) || shortTitle(title);
  lines.push(def.endsWith('.') ? def : `${def}.`);
  lines.push('');
  lines.push('Break the idea into three checks:');
  lines.push('1. Name the key terms precisely.');
  lines.push('2. State the relationship or process in one clear sentence.');
  lines.push('3. Attach one concrete Kenya-based example (home, school, farm, market, clinic, or workshop).');
  return lines.join('\n');
}

function applicationBlock(topic, title, facts) {
  const apps = facts.filter((f) =>
    /home|school|food|plant|soil|dam|bag|shoe|knife|toothpaste|water|kenya|daily|life|farm|market|hospital|phone|bulb|fire|pressure|root/i.test(
      f,
    ),
  );
  const lines = ['### Practical application / case study', ''];
  if (apps.length) {
    lines.push(
      apps
        .slice(0, 5)
        .map((a) => (a.endsWith('.') ? a : `${a}.`))
        .join(' '),
    );
    lines.push('');
    lines.push(
      `In Kenyan daily life, ${shortTitle(title).toLowerCase()} appears whenever you cook, travel, farm, use packaging labels, or stay safe around heat, electricity, and tools. Link each scientific term to something you can point to.`,
    );
  } else {
    lines.push(
      `Around the home and school, ${shortTitle(title).toLowerCase()} helps you explain why materials behave as they do — from cooking and cleaning to transport, farming, and health. Look for one object or event today that matches this page, and describe it using the correct scientific words.`,
    );
  }
  return lines.join('\n');
}

function practiceBlock(topic, title, facts) {
  const focus = shortTitle(title);
  const seed = facts.find((f) => f.length > 35) || focus;
  const qs = [
    `Define the main idea of **${focus}** in your own words (two to three sentences).`,
    `Using information from this page, explain: “${seed.slice(0, 110)}${seed.length > 110 ? '…' : ''}”`,
    `Give one real-life example in Kenya that demonstrates **${focus}**, and state which scientific terms apply.`,
    `Distinguish two related terms from this page and show how they differ.`,
    `Exam-style: A classmate claims “${focus} is only theory and not useful.” Write a short paragraph arguing against that claim with evidence from the notes.`,
  ];
  const sols = [
    `A strong answer names the concept precisely, uses vocabulary from the page, and avoids copying one sentence only. For **${focus}**, include what it is and why it matters.`,
    `Explain the quoted idea by restating it clearly, then add the reason/result shown in the study text. Mention units or examples if the page includes them.`,
    `Accept any accurate Kenya-linked example (home, school, farm, market, clinic, workshop) that correctly matches **${focus}**.`,
    `State each term, then contrast them on one clear point (what moves, what changes, what is measured, or what is formed).`,
    `Argue with applications from the page: safety, tools, food, health, energy, or materials. Mark for correct science, not long storytelling.`,
  ];

  const out = ['### Practice questions', ''];
  qs.forEach((q, i) => out.push(`${i + 1}. ${q}`, ''));
  out.push('### Solutions', '');
  sols.forEach((s, i) => out.push(`${i + 1}. ${s}`, ''));
  return out.join('\n').trim();
}

function buildPage(topic, pageNumber, totalPages, title, rawLines) {
  const facts = normalizePairs(rawLines);
  const heading = shortTitle(title).toUpperCase();
  const concept = proseFromFacts(facts, title);
  const worked = workedExample(topic, title, facts);
  const visual = visualFor(topic, title, facts);
  const app = applicationBlock(topic, title, facts);
  const practice = practiceBlock(topic, title, facts);

  let body = [
    `PAGE ${pageNumber} OF ${totalPages}: ${heading}`,
    '',
    `**Subject:** Integrated Science  `,
    `**Grade:** 8  `,
    `**Topic:** ${topic.topicNumber} ${topic.topicName}  `,
    `**Subtopic:** ${shortTitle(title)}`,
    '',
    '### Comprehensive concept explanation',
    '',
    concept,
    '',
    worked,
    '',
    visual,
    '',
    app,
    '',
    practice,
  ].join('\n');

  // Guard against teacher meta leaking in
  body = body
    .replace(/Today we study:[^\n]*/gi, '')
    .replace(/Today'?s idea[^\n]*/gi, '')
    .replace(/Your turn:[^\n]*/gi, '');
  if (BANNED.test(body)) {
    body = body
      .split('\n')
      .filter((line) => !BANNED.test(line))
      .join('\n');
  }

  return {
    pageNumber,
    title: shortTitle(title),
    body,
    free: !LOCK_MODE || pageNumber <= FREE_PAGES,
  };
}

function buildStudyPages(topic) {
  const sections = splitSections(topic);
  const chunks = [];
  for (const section of sections) {
    const parts = paginate(section.lines);
    parts.forEach((lines, i) => {
      const title = parts.length === 1 ? section.title : `${section.title} (${i + 1}/${parts.length})`;
      chunks.push({ title, lines });
    });
  }
  while (chunks.length < 6) {
    let maxI = 0;
    for (let i = 1; i < chunks.length; i += 1) {
      if (chunks[i].lines.join(' ').length > chunks[maxI].lines.join(' ').length) maxI = i;
    }
    const big = chunks[maxI];
    if (big.lines.length < 8) break;
    const mid = Math.ceil(big.lines.length / 2);
    chunks.splice(
      maxI,
      1,
      { title: `${big.title} (a)`, lines: big.lines.slice(0, mid) },
      { title: `${big.title} (b)`, lines: big.lines.slice(mid) },
    );
  }
  // Cap extremely long topics around 12 pages for study UX, merging tiny tails first
  while (chunks.length > 12) {
    // merge last two
    const a = chunks[chunks.length - 2];
    const b = chunks.pop();
    a.lines.push(...b.lines);
    a.title = shortTitle(a.title);
  }
  return chunks.map((c, i) => buildPage(topic, i + 1, chunks.length, c.title, c.lines));
}

function buildQuiz(topic, pages) {
  const facts = pages
    .flatMap((p) => p.body.split('\n'))
    .map((l) => l.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter((l) => l.length > 40 && l.length < 160 && !/^PAGE |^#|^Subject:|^Grade:|^Topic:|^Subtopic:|^\$\$|^```|^\|/i.test(l));

  const picked = [];
  const step = Math.max(1, Math.floor(facts.length / 12));
  for (let i = 0; i < facts.length && picked.length < 12; i += step) picked.push(facts[i]);

  const qLines = [
    `REVISION QUIZ: ${topic.topicName.toUpperCase()}`,
    '',
    'Answer using your study module. Show working for calculations.',
    '',
  ];
  const aLines = [`ANSWERS: ${topic.topicName.toUpperCase()}`, ''];
  for (let i = 0; i < 10; i += 1) {
    const fact = picked[i] || `${topic.topicName} is a Grade 8 Integrated Science topic.`;
    qLines.push(`${i + 1}. Which statement is scientifically correct about ${topic.topicName}?`);
    qLines.push(`   A. ${fact}`);
    qLines.push(`   B. ${topic.topicName} has no connection to daily life.`);
    qLines.push('   C. Definitions are unnecessary if you memorise headings only.');
    qLines.push('   D. Units and examples can always be ignored.');
    qLines.push('');
    aLines.push(`${i + 1}. A`);
    aLines.push(`   • ${fact}`);
    aLines.push('');
  }
  const shorts = [
    `Explain ${topic.topicName} using one clear Kenya-based example.`,
    `List five key scientific points from the study module on ${topic.topicName}.`,
    `Write a short paragraph summarising the most important idea in ${topic.topicName}.`,
    `Create one exam-style question on ${topic.topicName} and provide a model answer.`,
    `Describe one safety or daily-life decision that depends on understanding ${topic.topicName}.`,
  ];
  shorts.forEach((q, i) => {
    const n = 11 + i;
    qLines.push(`${n}. ${q}`);
    qLines.push('');
    aLines.push(`${n}. Award marks for scientifically accurate answers grounded in the study pages.`);
    aLines.push('');
  });
  return { quiz: qLines.join('\n'), answers: aLines.join('\n'), questionCount: 15 };
}

function buildVideoScript(topic, pages) {
  return [
    `VIDEO SCRIPT: ${topic.topicName.toUpperCase()}`,
    `Grade 8 Integrated Science · ${pages.length}-page student module`,
    '',
    `[0:00] Open on page 1 title: ${pages[0]?.title || topic.topicName}`,
    '[0:20] Read key concept paragraph; highlight definitions on screen',
    '[2:00] Worked example — write steps/formula live',
    '[3:30] Show visual model / table',
    '[4:20] Application case study',
    '[5:10] Direct learners to practice questions + solutions on the page',
    '[5:40] Continue remaining pages, then Revision Quiz tab',
    '',
    '— CBC Learn student module',
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
    (i.type === 'topic-lesson' || i.type === 'video-script') &&
    i.topic?.grade === content.topic.grade &&
    /INTEGRATED\s*SCIENCE/i.test(String(i.topic?.subject || '')) &&
    i.topic?.topicNumber === content.topic.topicNumber &&
    i.type === content.type;

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
      lesson: (content.pages.lesson || '').slice(0, 240) + '…',
      quiz: content.type === 'video-script' ? (content.pages.quiz || '').slice(0, 200) + '…' : '',
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

if (!existsSync(NOTES)) {
  console.error('Missing notes JSON:', NOTES);
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(NOTES, 'utf8'));
console.log(
  `Building STUDENT TEXTBOOK modules for ${catalog.subject} (${catalog.topics.length} topics)` +
    (LOCK_MODE ? ` [LOCK free=${FREE_PAGES}]` : ' [all pages unlocked]'),
);

for (const topic of catalog.topics) {
  const studyPages = buildStudyPages(topic);
  const quizData = buildQuiz(topic, studyPages);
  const freeCount = LOCK_MODE ? FREE_PAGES : studyPages.length;
  const slug = `${String(topic.topicNumber).replace(/\./g, '-')}-${topic.topicName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)}`;

  const lessonList = studyPages.map((p) => `Page ${p.pageNumber}: ${p.title}`).join('\n');
  const lessonPreview = [
    `STUDENT MODULE: ${topic.topicName.toUpperCase()}`,
    '',
    'Grade 8 · Integrated Science',
    `Strand: ${topic.strandName}`,
    `Topic ${topic.topicNumber}: ${topic.topicName}`,
    '',
    `• ${studyPages.length}-page student textbook module`,
    '• Page structure: Concept explanation → Worked example → Visual model → Application → Practice + Solutions',
    LOCK_MODE ? `• Free preview: pages 1–${FREE_PAGES}` : '• All pages unlocked (pre-publish)',
    '',
    lessonList,
  ].join('\n');

  const content = {
    id: randomUUID(),
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
      questionCount: quizData.questionCount,
      contentSource: 'g8-is-student-textbook-v4',
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

  const videoScript = buildVideoScript(topic, studyPages);
  saveLesson({
    id: randomUUID(),
    type: 'video-script',
    title: `Video: ${topic.topicName}`,
    topic: content.topic,
    pages: { lesson: '', quiz: videoScript, answers: '', studyPages: [] },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: videoScript.split(/\s+/).length,
      reviewed: false,
      access: 'free',
      priceKes: 0,
      contentSource: 'g8-is-student-textbook-v4',
      linkedLessonId: content.id,
    },
    sources: content.sources,
  });

  console.log(
    `  ✓ ${topic.topicNumber} ${topic.topicName}: ${studyPages.length} pages · ~${content.metadata.wordCount} words`,
  );
}

console.log('\nDone. Student textbook modules ready at /learn/grade-8/integrated-science');
