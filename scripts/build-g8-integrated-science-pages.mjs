#!/usr/bin/env node
/**
 * Grade 8 Integrated Science content engine
 * Implements: knowledge-base/prompts/g8-is-content-engine.md
 *
 * - Unique content per page (no template loops)
 * - No markdown tables / ASCII code diagrams (UI-safe bullets)
 * - Fact-checked symbols & formulas
 * - Written study module + 2D/3D cartoon video script per topic
 * - Consolidated modules (not tiny fragment pages)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
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

/** Verified element facts — never infer from OCR table columns */
const ENGLISH_SYMBOLS = [
  ['Hydrogen', 'H'],
  ['Helium', 'He'],
  ['Lithium', 'Li'],
  ['Beryllium', 'Be'],
  ['Boron', 'B'],
  ['Carbon', 'C'],
  ['Nitrogen', 'N'],
  ['Oxygen', 'O'],
  ['Fluorine', 'F'],
  ['Neon', 'Ne'],
  ['Sodium', 'Na'],
  ['Magnesium', 'Mg'],
  ['Aluminium', 'Al'],
  ['Chlorine', 'Cl'],
  ['Calcium', 'Ca'],
  ['Copper', 'Cu'],
];

const LATIN_SYMBOLS = [
  ['Sodium', 'Natrium', 'Na'],
  ['Potassium', 'Kalium', 'K'],
  ['Iron', 'Ferrum', 'Fe'],
  ['Copper', 'Cuprum', 'Cu'],
  ['Silver', 'Argentum', 'Ag'],
  ['Tin', 'Stannum', 'Sn'],
  ['Gold', 'Aurum', 'Au'],
  ['Lead', 'Plumbum', 'Pb'],
  ['Mercury', 'Hydrargyrum', 'Hg'],
  ['Zinc', 'Zincum', 'Zn'],
];

const FLUFF =
  /\b(keep the definitions precise|notice how each idea|look for one object|use the practice questions to test|read the concept text, then match|around the home and school, .* helps you explain|in this lesson|today we study|today'?s idea|your turn)\b/i;

function clean(s) {
  return String(s || '')
    .replace(/[\u00a0]+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bcompunds\b/gi, 'compounds')
    .replace(/\bflouride\b/gi, 'fluoride')
    .replace(/\bsort -hand\b/gi, 'shorthand')
    .replace(/\bration\b/gi, 'ratio')
    .replace(/\bgoogles\b/gi, 'goggles')
    .replace(/\bare can be\b/gi, 'can be')
    .replace(/\bA compound is pure substance\b/gi, 'A compound is a pure substance')
    .trim();
}

function isNoise(line) {
  const t = clean(line);
  if (!t || t.length < 2) return true;
  if (/^GRADE\s*\d+|LESSON NOTES|RATIONALIZED|^STRAND\s*\d/i.test(t)) return true;
  if (/^\d+$/.test(t)) return true;
  if (
    /^(Name of element|Chemical symbol|Latin name\.?|Volume|Density|Shape|Ability to flow|Compressibility|State of matter|Mineral element of compound|Examples of food sources|Objective lens|Eyepiece lens|Total magnification)/i.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

function stripBanned(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .split('\n')
    .filter((line) => {
      if (FLUFF.test(line)) return false;
      if (/^\s*\|/.test(line) && /\|/.test(line.slice(1))) return false; // markdown tables
      if (/^\s*\|?\s*:?-{3,}/.test(line)) return false;
      if (/^\s*[+|\\-]{3,}/.test(line)) return false; // ascii trees
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Logical modules per topic (consolidated, not OCR fragment spam).
 * Each module becomes ONE study page with unique content.
 */
function planModules(topic) {
  const paras = (topic.paragraphs || []).map(clean).filter((p) => !isNoise(p));
  const n = topic.topicNumber;
  const all = paras;

  if (n === '1.1') {
    return [
      {
        key: 'atoms-elements-compounds',
        title: 'Atoms, Elements and Compounds',
        facts: sliceByHeadings(all, null, /Relating common elements|symbols of some elements/i),
      },
      {
        key: 'chemical-symbols',
        title: 'Chemical Symbols of Elements',
        facts: sliceByHeadings(all, /Relating common elements|symbols of some elements derived from English/i, /Application of common elements|Food nutrients|Importance of/i),
        useSymbolMaps: true,
      },
      {
        key: 'daily-life-nutrition',
        title: 'Elements in Daily Life and Nutrition',
        facts: sliceByHeadings(all, /Application of common elements|Food nutrients|Mineral element/i, /Information on Packaging|Gold:|Importance of various/i),
      },
      {
        key: 'metals-packaging',
        title: 'Useful Metals and Packaging Labels',
        facts: sliceByHeadings(all, /Importance of various|Gold:|Information on Packaging/i, null),
      },
    ].filter((m) => m.facts.length >= 3 || m.useSymbolMaps);
  }

  if (n === '1.2') {
    return [
      { key: 'states', title: 'States of Matter and Their Properties', facts: sliceByHeadings(all, null, /Pure and Impure|Physical changes|Chemical changes/i) },
      { key: 'pure-impure', title: 'Pure and Impure Substances', facts: sliceByHeadings(all, /Pure and Impure/i, /Physical changes are|Chemical changes are|Applications of changes/i) },
      { key: 'physical-chemical', title: 'Physical and Chemical Changes', facts: sliceByHeadings(all, /Physical changes|Chemical changes/i, /Applications of changes/i) },
      { key: 'state-apps', title: 'Changes of State in Daily Life', facts: sliceByHeadings(all, /Applications of changes/i, null) },
    ].filter((m) => m.facts.length >= 4);
  }

  if (n === '1.3') {
    const mid = Math.ceil(all.length / 2);
    return [
      { key: 'fire-classes', title: 'Classes of Fire and the Fire Triangle', facts: all.slice(0, mid) },
      { key: 'fire-safety', title: 'Fire Safety and Extinguishing Methods', facts: all.slice(mid) },
    ].filter((m) => m.facts.length >= 3);
  }

  if (n === '2.1') {
    return [
      { key: 'cell-structure', title: 'Plant and Animal Cell Structures', facts: sliceByHeadings(all, null, /Magnification/i) },
      { key: 'magnification', title: 'Magnification with the Light Microscope', facts: sliceByHeadings(all, /Magnification/i, null) },
    ].filter((m) => m.facts.length >= 3);
  }

  if (n === '2.2') {
    const diffusionStart = /^(DIFFUSION\.?$|DIFFUSION\.\s+An experiment)|An experiment to demonstrate diffusion in liquids|Diffusion is defined/i;
    const osmosisStart = /^(OSMOSIS\.?$)|Osmosis is defined|Visking tubing|selectively permeable membrane/i;
    const rolesStart = /Role of osmosis in living things|In plants Osmosis plays|In animals,? Osmosis plays/i;
    return [
      {
        key: 'solutions',
        title: 'Solutes, Solvents and Concentration',
        facts: sliceByHeadings(all, /Solutes and solvent|Meaning of Terms|Concentration/i, diffusionStart),
      },
      {
        key: 'diffusion',
        title: 'Diffusion',
        facts: sliceByHeadings(all, diffusionStart, osmosisStart),
      },
      {
        key: 'osmosis',
        title: 'Osmosis and the Cell Membrane',
        facts: sliceByHeadings(all, osmosisStart, rolesStart),
      },
      {
        key: 'roles',
        title: 'Roles of Osmosis in Plants and Animals',
        facts: sliceByHeadings(all, rolesStart, null),
      },
    ].filter((m) => m.facts.length >= 2);
  }

  if (n === '2.3') {
    const mid = Math.ceil(all.length / 2);
    return [
      { key: 'reproduction', title: 'Human Reproductive Systems and Processes', facts: all.slice(0, mid) },
      { key: 'reproduction-care', title: 'Reproductive Health, Hygiene and Care', facts: all.slice(mid) },
    ].filter((m) => m.facts.length >= 3);
  }

  if (n === '3.1') {
    return [
      { key: 'forms', title: 'Forms of Energy', facts: sliceByHeadings(all, null, /Safety measures|Transformation|transformed/i) },
      { key: 'transform', title: 'Energy Transformations', facts: sliceByHeadings(all, /Transformation|transformed|Chemical energy/i, /Safety measures/i) },
      { key: 'safety', title: 'Safety with Energy Transformations', facts: sliceByHeadings(all, /Safety measures/i, null) },
    ].filter((m) => m.facts.length >= 3);
  }

  if (n === '3.2') {
    return [
      { key: 'meaning', title: 'Meaning of Pressure', facts: sliceByHeadings(all, null, /mathematical terms|Pressure =|Applications of pressure/i) },
      { key: 'calculate', title: 'Calculating Pressure in Solids and Liquids', facts: sliceByHeadings(all, /mathematical terms|Pressure =|P=|Pressure in liquids/i, /Applications of pressure/i) },
      { key: 'applications', title: 'Applications of Pressure in Daily Life', facts: sliceByHeadings(all, /Applications of pressure/i, null) },
    ].filter((m) => m.facts.length >= 3);
  }

  // Fallback: chunk into up to 4 modules
  const size = Math.ceil(all.length / 4);
  const mods = [];
  for (let i = 0; i < all.length && mods.length < 4; i += size) {
    mods.push({
      key: `part-${mods.length + 1}`,
      title: `${topic.topicName} — Part ${mods.length + 1}`,
      facts: all.slice(i, i + size),
    });
  }
  return mods.filter((m) => m.facts.length);
}

function sliceByHeadings(paras, startRx, endRx) {
  let start = 0;
  if (startRx) {
    const i = paras.findIndex((p) => startRx.test(p));
    start = i >= 0 ? i : 0;
  }
  let end = paras.length;
  if (endRx) {
    const i = paras.findIndex((p, idx) => idx > start && endRx.test(p));
    if (i >= 0) end = i;
  }
  return paras.slice(start, end).filter((p) => !/^(Requirements|Procedure|Caution)\b/i.test(p));
}

function pickFacts(facts, limit = 10) {
  return facts
    .map(clean)
    .filter((f) => f.length > 20 && !/^(For example,?|Requirements|Procedure)/i.test(f))
    .slice(0, limit);
}

function conceptOverview(module, topic) {
  const facts = pickFacts(module.facts, 12);
  const lines = ['### 1. Concept Overview', ''];

  if (module.key === 'atoms-elements-compounds') {
    lines.push(
      '- **Matter:** Anything that occupies space and has mass. Matter exists as pure substances or mixtures.',
      '- **Pure substances:** Have a fixed composition. They are either **elements** or **compounds**.',
      '- **Mixtures:** Combinations that can be uniform (homogeneous) or non-uniform (heterogeneous).',
      '- **Element:** A pure substance that cannot be broken down into simpler substances by chemical or physical means. Elements are the building blocks of matter.',
      '- **Atom:** The smallest particle of an element that still represents that element. Atoms of the same element are chemically identical.',
      '- **Compound:** A pure substance formed when atoms of two or more different elements join chemically in fixed proportions.',
      '- Compounds can be broken down into elements only through chemical reactions (not by simple physical separation).',
    );
    return lines.join('\n');
  }

  if (module.key === 'chemical-symbols' || module.useSymbolMaps) {
    lines.push(
      '- A **chemical symbol** is a short universal notation for an element’s name.',
      '- Scientists use symbols because they are shorter, clearer, and recognized worldwide.',
      '- **Capitalization rule:** the first letter is always a capital; any second letter is lowercase (example: Ca for calcium, not CA or ca).',
      '- Some symbols come from English names (H, O, C). Others come from Latin names (Na from Natrium, Fe from Ferrum).',
      '- Compounds are written with a **chemical formula** that shows which elements are present and in what ratio (example: H2O, NaCl).',
    );
    return lines.join('\n');
  }

  // Dynamic bullets from page facts (unique per module)
  lines.push(`Key ideas for **${module.title}** in Topic ${topic.topicNumber}:`);
  lines.push('');
  const seen = new Set();
  for (const f of facts) {
    const key = f.toLowerCase().slice(0, 48);
    if (seen.has(key)) continue;
    seen.add(key);
    const bullet = f.length > 180 ? `${f.slice(0, 177)}...` : f;
    lines.push(`- ${bullet.endsWith('.') ? bullet : `${bullet}.`}`);
    if (lines.length > 14) break;
  }
  return lines.join('\n');
}

function practicalExamples(module, topic) {
  const lines = ['### 2. Practical Examples & Formulas', ''];
  const key = module.key;

  if (key === 'atoms-elements-compounds') {
    lines.push(
      '- **Water (H2O):** Hydrogen and oxygen combine chemically in a **2:1** ratio.',
      '- **Common salt (NaCl):** Sodium (Na) and chlorine (Cl) combine in a **1:1** ratio.',
      '- Pure iron in a jembe blade is mostly an **element** sample; rust forming on it involves a **chemical change** producing new compounds.',
      '- Cooking oil mixed with water is a **mixture** (not a compound): the substances are not chemically bonded in fixed proportions.',
    );
    return lines.join('\n');
  }

  if (key === 'chemical-symbols' || module.useSymbolMaps) {
    lines.push('**English-name symbols (selected):**');
    ENGLISH_SYMBOLS.slice(0, 10).forEach(([name, sym]) => lines.push(`- **${name}** → ${sym}`));
    lines.push('');
    lines.push('**Latin-name symbols (selected):**');
    LATIN_SYMBOLS.forEach(([name, latin, sym]) => lines.push(`- **${name}** → *${latin}* → ${sym}`));
    lines.push('');
    lines.push('- Warning: **CO** means the compound carbon monoxide; **Co** means the element cobalt. Capitalization changes meaning.');
    return lines.join('\n');
  }

  if (key === 'daily-life-nutrition') {
    lines.push(
      '- **Carbon, hydrogen, oxygen:** Core elements in carbohydrates, fats, and many foods (ugali, rice, potatoes, oils).',
      '- **Nitrogen:** Needed for proteins; found in meat, fish, eggs, beans, and milk.',
      '- **Calcium:** Strong bones and teeth; milk, sukuma wiki, and other green vegetables.',
      '- **Iron:** Needed for healthy blood; liver, red meat, beans, spinach.',
      '- **Fluoride:** Helps protect teeth; present in some fish, tea, and toothpaste compounds.',
      '- **Sodium chloride (NaCl):** Common salt used in cooking and food preservation.',
    );
    return lines.join('\n');
  }

  if (key === 'metals-packaging') {
    lines.push(
      '- **Gold (Au):** Soft, attractive, resists rusting; used in jewellery and some electronics.',
      '- **Silver (Ag):** Used in jewellery and cutlery; can tarnish/discolour.',
      '- **Iron / steel:** Strong and workable; steel (iron + carbon) is vital in construction and tools.',
      '- Packaging labels list elements/compounds in products (toothpaste may list sodium fluoride; bottled water lists calcium, sodium, magnesium, potassium).',
    );
    return lines.join('\n');
  }

  if (key === 'meaning') {
    lines.push(
      '- Pressure is the force acting normally (perpendicularly) per unit area.',
      '- Everyday idea: the same bag weight feels more painful on thin straps than on wide pads because area is smaller.',
      '- Symbol **P**; force **F** in newtons; area **A** in m².',
    );
    return lines.join('\n');
  }
  if (key === 'calculate') {
    lines.push(
      '- Formula (solids): **P = F / A**',
      '- Units: P in N/m² (pascal, Pa); F in N; A in m².',
      '- Worked values: F = 200 N, A = 0.50 m² → P = 200 / 0.50 = **400 Pa**.',
      '- Liquids: **P = hρg** (depends on depth h, density ρ, and g).',
    );
    return lines.join('\n');
  }
  if (key === 'applications' && /pressure/i.test(topic.topicName)) {
    lines.push(
      '- Sharp knife/jembe edge: small area → high pressure → easier cutting/digging.',
      '- Broad camel/elephant feet: large area → lower pressure on soft ground.',
      '- Dam walls thicker at the bottom because liquid pressure increases with depth.',
      '- Elevated water tanks increase pressure for home supply.',
    );
    return lines.join('\n');
  }

  if (key === 'diffusion') {
    lines.push(
      '- Perfume opened in one corner of a classroom is soon smelled elsewhere: particles move from high to low concentration (**diffusion**).',
      '- A drop of ink in water spreads without stirring — diffusion in a liquid.',
      '- Diffusion is faster when particles are warmer / moving more energetically, and slower across longer distances.',
    );
    return lines.join('\n');
  }

  if (key === 'osmosis') {
    lines.push(
      '- **Osmosis:** movement of **water** across a **selectively permeable membrane** from a dilute solution toward a more concentrated solution.',
      '- Model: visking tubing filled with concentrated sugar solution, placed in distilled water, gains mass/volume as water enters.',
      '- The membrane lets water through more readily than large solute particles — that selectivity is the key idea.',
    );
    return lines.join('\n');
  }
  if (key === 'roles') {
    lines.push(
      '- **In plants:** root hairs take in soil water partly by osmosis; turgid cells help support soft stems and leaves.',
      '- **In animals:** osmosis helps keep body-fluid balance; red blood cells behave differently in dilute vs concentrated surrounding fluids.',
      '- Too much water entering animal cells can make them swell/burst; too little water can make them shrink — balance matters.',
    );
    return lines.join('\n');
  }

  if (key === 'magnification') {
    lines.push(
      '- Total magnification = eyepiece magnification × objective magnification.',
      '- Example: eyepiece ×10 and objective ×40 → total **×400**.',
      '- The “×” means “times larger than actual size.”',
    );
    return lines.join('\n');
  }

  if (key === 'fire-classes') {
    lines.push(
      '- Fire needs the **fire triangle**: fuel, heat, and oxygen. Remove one and the fire can go out.',
      '- Class A (wood/paper/cloth): often cooled with water where safe.',
      '- Class B (petrol/oils): do **not** use water; smother / correct extinguisher.',
      '- Always match the extinguishing method to the fuel type.',
    );
    return lines.join('\n');
  }

  if (key === 'states') {
    lines.push(
      '- **Solids:** definite shape and volume; particles tightly packed; almost incompressible (ice cube keeps shape on a plate).',
      '- **Liquids:** definite volume, **no** definite shape — they take the shape of the container (milk in a cup vs spilled on a floor).',
      '- **Gases:** no fixed shape or volume; fill the available space; highly compressible (air in a soft drink bottle).',
      '- Density pattern (general): solids usually densest, liquids intermediate, gases least dense.',
    );
    return lines.join('\n');
  }
  if (key === 'physical-chemical') {
    lines.push(
      '- **Physical change:** no new substance forms; often reversible (ice melting to water; water freezing back to ice).',
      '- **Chemical change:** new substances form; usually difficult to reverse simply (burning paper → ash + gases; baking soda + vinegar → CO2 + new products).',
      '- Melting/freezing/evaporation/condensation are **physical** (still the same substance, e.g. H2O).',
      '- Rusting iron or cooking an egg are **chemical** (new substances appear).',
    );
    return lines.join('\n');
  }
  if (key === 'state-apps') {
    lines.push(
      '- Drying wet clothes: water evaporates (liquid → gas) — a useful physical change of state.',
      '- Making ice for coolers: water freezes (liquid → solid).',
      '- Cooking stews: water boils/evaporates; steam can condense on cooler lids.',
      '- Safety: steam and boiling water cause severe burns — keep pots stable and lids handled with care.',
    );
    return lines.join('\n');
  }

  if (key === 'forms') {
    lines.push(
      '- Common forms: chemical, electrical, kinetic, potential, light, heat, sound.',
      '- Food and dry cells store **chemical energy**.',
      '- Moving boda bodas / flowing water show **kinetic energy**.',
    );
    return lines.join('\n');
  }
  if (key === 'transform') {
    lines.push(
      '- Torch chain: **chemical → electrical → light (+ heat)**.',
      '- Solar home systems: light energy → electrical energy → light/phone charging.',
      '- Energy can change form; track each step with the correct form names.',
    );
    return lines.join('\n');
  }
  if (key === 'safety') {
    lines.push(
      '- Damaged cables, wet hands on sockets, and overloaded extensions are major electrical hazards.',
      '- Keep flammable materials away from open flames and hot bulbs.',
      '- Use insulation, correct plugs/fuses, and switch off devices when not in use.',
    );
    return lines.join('\n');
  }
  if (key === 'solutions') {
    lines.push(
      '- **Solute:** substance that dissolves (e.g. sugar, salt).',
      '- **Solvent:** liquid that does the dissolving (usually water).',
      '- **Solution:** mixture formed when solute dissolves in solvent.',
      '- Concentrated vs dilute depends on how much solute is present compared with solvent.',
    );
    return lines.join('\n');
  }
  if (key === 'fire-safety') {
    lines.push(
      '- Match extinguisher/method to fire class; water is not universal.',
      '- Remove heat, fuel, or oxygen (fire triangle thinking).',
      '- Raise alarm early; evacuate; never fight a large fire alone.',
    );
    return lines.join('\n');
  }
  if (key === 'reproduction') {
    lines.push(
      '- The **menstrual cycle** (about 28–35 days) prepares the female body for a possible pregnancy; hormones act as chemical messengers that time the stages.',
      '- **Ovulation** releases an ovum; **fertilization** occurs when one sperm successfully joins with the ovum.',
      '- After fertilization, implantation in the uterus is the next key process described in the notes.',
      '- Use accurate scientific terms for organs and processes — avoid slang or myths.',
    );
    return lines.join('\n');
  }
  if (key === 'reproduction-care') {
    lines.push(
      '- Manage menstrual discomfort with rest, warmth, and school-appropriate hygiene products; see a clinician if pain or irregular bleeding persists.',
      '- Personal hygiene during menstruation protects health and dignity at home and school.',
      '- Ask trusted adults/health workers for accurate information; reject myths and unsafe advice from peers alone.',
      '- Respect privacy: reproductive topics are scientific and personal — discuss them responsibly.',
    );
    return lines.join('\n');
  }
  if (key === 'pure-impure') {
    lines.push(
      '- Pure substances have fixed melting/boiling behaviour; impurities usually change these points.',
      '- A mixture is an impure combination of substances not chemically bonded as one compound.',
      '- Laboratory checks can compare melting/boiling behaviour of pure vs impure samples.',
    );
    return lines.join('\n');
  }

  // Fallback unique to module facts
  const facts = pickFacts(module.facts, 6);
  facts.forEach((f, i) => lines.push(`- Example ${i + 1}: ${f}`));
  return lines.join('\n');
}

function visualModel(module, topic) {
  const lines = ['### 3. Visual Description Model', ''];
  const key = module.key;

  if (key === 'atoms-elements-compounds') {
    lines.push(
      '- Picture three levels of structure:',
      '  - **Atom** — smallest unit of an element',
      '  - **Many identical atoms together** → sample of an **element** (e.g. pure copper wire)',
      '  - **Different atoms chemically bonded** → a **compound** (e.g. NaCl crystals, H2O molecules)',
    );
    return lines.join('\n');
  }

  if (key === 'chemical-symbols' || module.useSymbolMaps) {
    lines.push(
      '- Imagine a classroom periodic-name chart:',
      '  - Left column: element name in English',
      '  - Right column: symbol with correct capitals (H, O, Na, Fe, Au)',
      '- For Latin-origin symbols, add a middle note: Sodium — *Natrium* — Na',
    );
    return lines.join('\n');
  }

  if (key === 'states') {
    lines.push(
      '- Particle picture for the three states:',
      '  - **Solid:** particles tightly packed, vibrating in place',
      '  - **Liquid:** particles close but sliding past each other',
      '  - **Gas:** particles far apart, moving freely and filling the space',
    );
    return lines.join('\n');
  }
  if (key === 'physical-chemical') {
    lines.push(
      '- Two parallel pathways:',
      '  - **Physical path:** ice cube → liquid water → steam (same H2O particles rearranging)',
      '  - **Chemical path:** paper + oxygen → ash + smoke/gases (new substances appear)',
      '- Check questions on the diagram: “Was a new substance formed?” and “Can I reverse it easily?”',
    );
    return lines.join('\n');
  }
  if (key === 'state-apps') {
    lines.push(
      '- Household cycle sketch:',
      '  - Wet laundry → evaporation → dry clothes',
      '  - Freezer tray → freezing → ice blocks',
      '  - Hot pot lid → condensation droplets forming',
    );
    return lines.join('\n');
  }

  if (key === 'diffusion') {
    lines.push(
      '- High-concentration cloud of perfume particles on one side of a room',
      '- Arrows show net movement toward the low-concentration side until smell is spread out',
      '- No membrane required for diffusion',
    );
    return lines.join('\n');
  }

  if (key === 'osmosis') {
    lines.push(
      '- Lab model layout:',
      '  - Beaker of distilled water',
      '  - Visking tubing bag with concentrated sugar solution inside',
      '  - Water arrows enter the tubing; tubing swells / gains mass',
      '- Label the tubing as a **selectively permeable membrane** model',
    );
    return lines.join('\n');
  }
  if (key === 'roles') {
    lines.push(
      '- Split scene:',
      '  - **Plant side:** root hair in moist soil; water arrows enter the hair cell',
      '  - **Animal side:** cell in dilute fluid swells; cell in concentrated fluid shrinks',
      '- Caption: osmosis maintains useful water balance in living tissues',
    );
    return lines.join('\n');
  }

  if (key === 'meaning') {
    lines.push(
      '- Two school bags with equal books: wide pads vs thin straps',
      '- Same force, different contact area → different discomfort (pressure idea)',
    );
    return lines.join('\n');
  }
  if (key === 'calculate') {
    lines.push(
      '- Force arrow **F** on area patch **A**',
      '- Formula callout: **P = F / A**',
      '- Number strip example: 200 N ÷ 0.50 m² = 400 Pa',
    );
    return lines.join('\n');
  }
  if (key === 'applications' && /pressure/i.test(topic.topicName)) {
    lines.push(
      '- Knife edge / jembe tip (small area)',
      '- Camel foot / wooden plank under wheelbarrow (large area)',
      '- Dam cross-section thicker at depth',
    );
    return lines.join('\n');
  }

  if (key === 'fire-classes') {
    lines.push(
      '- Fire triangle with three sides: **Fuel**, **Heat**, **Oxygen**',
      '- Removing any one side collapses the triangle (fire goes out)',
    );
    return lines.join('\n');
  }

  if (key === 'cell-structure') {
    lines.push(
      '- Side-by-side cell outlines:',
      '  - **Plant cell:** cell wall outside, cell membrane inside, nucleus, cytoplasm, chloroplasts, large vacuole',
      '  - **Animal cell:** cell membrane, nucleus, cytoplasm — typically no cell wall and no chloroplasts',
      '- Shared parts (nucleus/cytoplasm/membrane) sit in the middle of the comparison',
    );
    return lines.join('\n');
  }
  if (key === 'magnification') {
    lines.push(
      '- Light-microscope path sketch:',
      '  - Light → specimen on stage → **objective lens** → tube → **eyepiece lens** → eye',
      '- Callout formula: **total magnification = eyepiece × objective**',
      '- Example strip: ×10 × ×40 → **×400**',
    );
    return lines.join('\n');
  }

  if (key === 'forms') {
    lines.push('- Icon row: food (chemical), moving ball (kinetic), sun (light), stove (heat), radio (sound)');
    return lines.join('\n');
  }
  if (key === 'transform') {
    lines.push('- Energy baton pass: Chemical (dry cell) → Electrical (wires) → Light/Heat (bulb)');
    return lines.join('\n');
  }
  if (key === 'safety') {
    lines.push('- Safety icons: insulated cable, dry hands, correct fuse/plug, no overloaded extension');
    return lines.join('\n');
  }
  if (key === 'solutions') {
    lines.push(
      '- Beaker of water (solvent) + sugar crystals (solute) → sweet solution',
      '- Labels: dilute (few crystals) vs concentrated (many crystals)',
    );
    return lines.join('\n');
  }
  if (key === 'fire-safety') {
    lines.push('- Extinguisher choice chart by fire class; evacuation arrows to assembly point');
    return lines.join('\n');
  }

  // Unique fallback from module title + first facts
  const bits = pickFacts(module.facts, 3);
  lines.push(`- Focus diagram for **${module.title}**:`);
  bits.forEach((b) => lines.push(`  - ${b}`));
  return lines.join('\n');
}

function applications(module, topic) {
  const lines = ['### 4. Real-World Applications & Safety', ''];
  const key = module.key;
  const fromNotes = pickFacts(
    module.facts.filter((f) => /food|plant|home|school|safety|toothpaste|dam|knife|bag|farm|water|health|tooth|fire|pressure|energy|cable/i.test(f)),
    5,
  );

  if (key === 'atoms-elements-compounds' || key === 'chemical-symbols') {
    lines.push(
      '- Reading medicine and food labels becomes easier when you recognize element/compound names and formulas.',
      '- Lake Magadi / coastal salt processing supplies **NaCl** used in Kenyan kitchens for cooking and preservation.',
      '- Safety: never taste unknown chemicals in the lab; symbols and formulas identify hazards quickly.',
    );
    return lines.join('\n');
  }

  if (key === 'daily-life-nutrition' || key === 'metals-packaging') {
    lines.push(
      '- Balanced meals use element-rich foods: proteins (N), bones (Ca), blood health (Fe).',
      '- Toothpaste with fluoride compounds helps reduce tooth decay.',
      '- Construction and tools rely on iron/steel; jewellery may use gold or silver.',
      '- Safety: follow label instructions for detergents and medicines that list chemical ingredients.',
    );
    return lines.join('\n');
  }

  if (/pressure/i.test(topic.topicName)) {
    lines.push(
      '- Sharp knives and jembes cut well because a small edge area creates high pressure.',
      '- Camels/elephants have broad feet to reduce ground pressure.',
      '- Dam walls are thicker at the bottom because liquid pressure increases with depth.',
      '- Safety: never stand under unsupported heavy loads; pressure and force can cause injury.',
    );
    return lines.join('\n');
  }

  if (key === 'fire-classes') {
    lines.push(
      '- Know your school fire extinguisher types and assembly points.',
      '- Never throw water on petrol/oil fires or electrical fires.',
      '- Safety first: raise alarm, get help, do not fight a large fire alone.',
    );
    return lines.join('\n');
  }

  if (fromNotes.length) {
    fromNotes.forEach((f) => lines.push(`- ${f.endsWith('.') ? f : `${f}.`}`));
    lines.push('- Safety: follow teacher/lab instructions; protect eyes and handle heat sources carefully.');
    return lines.join('\n');
  }

  lines.push(
    `- Apply **${module.title}** to home, school, farm, or market examples in Kenya.`,
    '- Safety: observe carefully, use correct equipment, and report hazards.',
  );
  return lines.join('\n');
}

function practiceBlock(module, topic, pageNumber) {
  const title = module.title;
  const key = module.key;
  const lines = ['### 5. Targeted Subtopic Practice', '', '#### Practice Questions', ''];

  // Fully unique question banks by module key
  const banks = {
    'atoms-elements-compounds': [
      ['Recall', 'Define **element** and **compound**, each in one clear sentence.'],
      ['Application', 'Explain why table salt (NaCl) is a compound while a copper wire can be treated as an element sample.'],
      ['Exam', 'A learner says mixtures and compounds are the same because both contain more than one substance. Write two points correcting this claim.'],
    ],
    'chemical-symbols': [
      ['Recall', 'State the capitalization rule for chemical symbols and give one correct example.'],
      ['Application', 'A student writes calcium as CA and copper as cu. Correct both symbols and name the rule broken.'],
      ['Exam', 'Why do scientists prefer symbols like Fe and Na instead of only English names? Give two reasons.'],
      ['Latin', 'Give the Latin names and symbols for iron and sodium.'],
    ],
    'daily-life-nutrition': [
      ['Recall', 'Name three elements commonly found in food nutrients.'],
      ['Application', 'Link calcium and iron to one Kenyan food source each and state why the body needs them.'],
      ['Exam', 'Explain how reading a packaging label helps you identify elements/compounds in toothpaste or bottled water.'],
    ],
    'metals-packaging': [
      ['Recall', 'State one use of gold and one use of iron/steel.'],
      ['Application', 'Why is steel preferred to pure soft metals for building frames?'],
      ['Exam', 'Using packaging examples, show how element/compound names appear in everyday products.'],
    ],
    diffusion: [
      ['Recall', 'Define diffusion.'],
      ['Application', 'Describe a classroom perfume/ink example and state the concentration direction of particle movement.'],
      ['Exam', 'Why can you smell food cooking from another room even when doors are only slightly open?'],
    ],
    osmosis: [
      ['Recall', 'Define osmosis and name the type of membrane involved.'],
      ['Application', 'Explain what happens to visking tubing containing concentrated sugar solution placed in distilled water.'],
      ['Exam', 'Compare osmosis and diffusion using two clear differences.'],
    ],
    roles: [
      ['Recall', 'State one role of osmosis in plants and one in animals.'],
      ['Application', 'How does osmosis help root hairs take up water?'],
      ['Exam', 'What could happen to animal cells if they take in too much water by osmosis?'],
    ],
    calculate: [
      ['Recall', 'Write the formula for pressure in solids and state SI units of P, F, and A.'],
      ['Application', 'Calculate pressure when F = 200 N and A = 0.50 m². Show steps.'],
      ['Exam', 'Why does a sharp knife cut more easily than a blunt knife for the same force?'],
    ],
    meaning: [
      ['Recall', 'Define pressure.'],
      ['Application', 'Use school-bag straps (wide vs narrow) to explain pressure.'],
      ['Exam', 'Two learners of equal weight stand on mud: one in flat shoes, one in sharp heels. Who sinks more and why?'],
    ],
    applications: [
      ['Recall', 'List two applications of pressure in solids and two in liquids.'],
      ['Application', 'Explain why dam walls are thicker at the bottom.'],
      ['Exam', 'How do studs on football boots use pressure to improve grip?'],
    ],
    'state-apps': [
      ['Recall', 'Name two useful everyday changes of state.'],
      ['Application', 'Explain drying clothes using evaporation.'],
      ['Exam', 'Why is boiling water a physical change even though the water “disappears” as steam?'],
    ],
    'fire-classes': [
      ['Recall', 'Name the three parts of the fire triangle.'],
      ['Application', 'Why is water unsuitable for a petrol fire?'],
      ['Exam', 'Classify a burning classroom noticeboard fire and state a safe first response.'],
    ],
    'fire-safety': [
      ['Recall', 'State two safe actions when you first notice a fire at school.'],
      ['Application', 'Explain how removing oxygen can stop a small covered pan fire.'],
      ['Exam', 'Design a 4-step class fire-response plan using fire-triangle ideas.'],
    ],
    solutions: [
      ['Recall', 'Define solute, solvent, and solution.'],
      ['Application', 'Is sugary tea concentrated or dilute if a lot of sugar was added? Explain.'],
      ['Exam', 'Why is water called the universal solvent in many school experiments?'],
    ],
    'reproduction-care': [
      ['Recall', 'State two hygiene practices that support reproductive health.'],
      ['Application', 'Why should learners rely on scientific sources instead of myths?'],
      ['Exam', 'Write three respectful help-seeking steps for a reproductive-health concern.'],
    ],
    reproduction: [
      ['Recall', 'Name the main stages/processes covered on this page using correct terms.'],
      ['Application', 'Explain one process from the notes in simple scientific language.'],
      ['Exam', 'Why is accurate vocabulary important when studying human reproduction?'],
    ],
    forms: [
      ['Recall', 'List four forms of energy.'],
      ['Application', 'Identify the energy form stored in ugali/food and in a dry cell.'],
      ['Exam', 'Classify sunlight, a moving football, and a stretched catapult by energy form.'],
    ],
    transform: [
      ['Recall', 'Write the energy chain in a simple torch.'],
      ['Application', 'Describe energy changes in a solar lamp used at home.'],
      ['Exam', 'Why do we say energy is transformed rather than destroyed in these examples?'],
    ],
    safety: [
      ['Recall', 'List three electrical safety rules.'],
      ['Application', 'Why is using a phone charger with a frayed cable dangerous?'],
      ['Exam', 'Create a home energy-safety checklist with five items.'],
    ],
    'pure-impure': [
      ['Recall', 'What is a mixture?'],
      ['Application', 'How can melting/boiling behaviour help identify impure samples?'],
      ['Exam', 'Is salt water a pure substance? Justify scientifically.'],
    ],
    states: [
      ['Recall', 'State the shape and volume properties of solids, liquids, and gases.'],
      ['Application', 'Why can you compress air in a bottle more easily than water?'],
      ['Exam', 'Correct this error: “Liquids have a definite shape.” Explain the right statement.'],
    ],
    'physical-chemical': [
      ['Recall', 'Differentiate physical and chemical changes with one example each.'],
      ['Application', 'Is melting ice physical or chemical? Justify.'],
      ['Exam', 'Burning paper and freezing water look like “changes.” Compare them using products formed and reversibility.'],
    ],
    magnification: [
      ['Recall', 'Write the formula for total magnification.'],
      ['Application', 'Eyepiece ×10, objective ×4. Calculate total magnification.'],
      ['Exam', 'Why do microscopes use more than one lens?'],
    ],
    'cell-structure': [
      ['Recall', 'Name three structures found in plant cells but not in animal cells (or typically not).'],
      ['Application', 'Why do plant cells need chloroplasts?'],
      ['Exam', 'Compare plant and animal cells using two similarities and two differences.'],
    ],
  };

  const fallback = [
    ['Recall', `Define the main idea of **${title}** in your own words.`],
    ['Application', `Give one Kenyan daily-life example that shows **${title}**.`],
    ['Exam', `Write a short exam paragraph explaining why **${title}** matters in Integrated Science.`],
  ];

  const qs = banks[key] || fallback;
  const sols = modelSolutions(module, topic, qs);

  qs.forEach((q, i) => {
    lines.push(`${i + 1}. **(${q[0]})** ${q[1]}`);
    lines.push('');
  });
  lines.push('#### Model Solutions');
  lines.push('');
  sols.forEach((s, i) => {
    lines.push(`${i + 1}. ${s}`);
    lines.push('');
  });
  return lines.join('\n').trim();
}

function modelSolutions(module, topic, qs) {
  const key = module.key;
  const map = {
    'atoms-elements-compounds': [
      'An **element** is a pure substance that cannot be broken down chemically/physically into simpler substances. A **compound** is a pure substance made when different elements chemically combine in fixed proportions.',
      'NaCl contains sodium and chlorine chemically bonded (compound). A copper wire is made of copper atoms of one element (element sample).',
      'Mixtures are not chemically bonded in fixed ratios and can often be separated physically; compounds involve chemical bonding and need chemical methods to separate into elements.',
    ],
    'chemical-symbols': [
      'First letter capital, second letter (if any) lowercase — e.g. Ca, Na, Fe.',
      'Correct forms: **Ca** and **Cu**. The student violated capitalization rules.',
      'Symbols are short, language-independent, and avoid confusion between similar names.',
      'Iron → *Ferrum* → Fe; Sodium → *Natrium* → Na.',
    ],
    'daily-life-nutrition': [
      'Any three of C, H, O, N, Ca, Fe, Na, Cl, F (fluoride), etc.',
      'Calcium — milk/sukuma wiki (bones/teeth). Iron — liver/beans/spinach (blood/hemoglobin).',
      'Labels list ingredients/elements so consumers know composition and safety-related contents.',
    ],
    calculate: [
      'P = F/A; P in Pa (N/m²), F in N, A in m².',
      'P = 200 / 0.50 = 400 Pa.',
      'Sharp edge → smaller area → larger pressure for the same force.',
    ],
    diffusion: [
      'Diffusion is net movement of particles from high to low concentration.',
      'Perfume/ink particles spread from where they are concentrated to where they are less concentrated.',
      'Cooking smells travel as gas particles diffuse through air.',
    ],
    osmosis: [
      'Osmosis is movement of water across a selectively permeable membrane from dilute toward more concentrated solution.',
      'Water enters the tubing; the tubing swells/gains mass because the membrane allows water more readily than sugar.',
      'Both move particles, but osmosis specifically involves water across a selectively permeable membrane; diffusion does not require that membrane.',
    ],
    roles: [
      'Plants: water uptake/turgor support. Animals: body-fluid / cell water balance.',
      'Root hairs are in contact with dilute soil solution; water moves into the more concentrated cell sap by osmosis.',
      'Excess water entry can make animal cells swell/burst; too little water can make them shrink — harmful imbalance.',
    ],
    states: [
      'Solids: definite shape + volume. Liquids: definite volume, no definite shape. Gases: no definite shape or volume.',
      'Gas particles are far apart with weak forces, so they compress easily; liquid particles are close, so volume barely changes.',
      'Correct statement: liquids have definite volume but take the shape of their container (no definite shape of their own).',
    ],
    'physical-chemical': [
      'Physical: melting ice (same substance). Chemical: burning paper (new substances).',
      'Melting ice is physical — H2O remains H2O; no new substance forms.',
      'Burning paper forms new products and is hard to reverse; freezing water is physical, reversible, same substance.',
    ],
    'state-apps': [
      'Examples: drying clothes (evaporation), making ice (freezing), steam from boiling soup (boiling/evaporation).',
      'Liquid water on fabric becomes water vapour and leaves the cloth, so the clothes feel dry.',
      'Steam is still water (H2O) in the gas state — a physical change of state, not a new chemical substance.',
    ],
    reproduction: [
      'Use the stage names from the notes (e.g. menstruation, ovulation, fertilization, implantation) with short accurate definitions.',
      'Explain one chosen process with correct organs/terms and the scientific sequence from the module.',
      'Accurate vocabulary prevents myths and helps clear communication with teachers and health workers.',
    ],
    'reproduction-care': [
      'Examples: regular washing, using clean sanitary products, changing pads/tampons as needed, hand hygiene.',
      'Myths can lead to unsafe practices; scientific sources and clinicians give evidence-based guidance.',
      'Tell a trusted adult → visit a clinic/school nurse if needed → follow professional advice; keep privacy/respect.',
    ],
    solutions: [
      'Solute dissolves; solvent does the dissolving; solution is the resulting mixture.',
      'Lots of sugar relative to water → concentrated sugary tea.',
      'Water dissolves many common solutes used in school labs and kitchens, so it is often called a universal solvent in that limited school sense.',
    ],
  };
  if (map[key]) return map[key].slice(0, qs.length);
  return qs.map((q) => `Model answer should address the ${q[0].toLowerCase()} demand using accurate facts from **${module.title}** (Topic ${topic.topicNumber}).`);
}

function buildStudyPage(topic, module, pageNumber, totalPages) {
  const body = stripBanned(
    [
      `# Grade 8 Integrated Science`,
      `## Topic ${topic.topicNumber}: ${topic.topicName}`,
      `### PAGE ${pageNumber} OF ${totalPages}: ${module.title}`,
      '',
      `**Subject:** Integrated Science  `,
      `**Grade:** 8  `,
      `**Strand:** ${topic.strandName}  `,
      `**Subtopic:** ${module.title}`,
      '',
      '---',
      '',
      conceptOverview(module, topic),
      '',
      practicalExamples(module, topic),
      '',
      visualModel(module, topic),
      '',
      applications(module, topic),
      '',
      practiceBlock(module, topic, pageNumber),
    ].join('\n'),
  );

  // Hard safety: strip any leaked tables/code fences
  const safe = body
    .split('\n')
    .filter((line) => !/^\|/.test(line) && !/^```/.test(line) && !/\|---\|/.test(line))
    .join('\n');

  return {
    pageNumber,
    title: module.title,
    body: safe,
    free: !LOCK_MODE || pageNumber <= FREE_PAGES,
  };
}

function buildVideoScript(topic, modules) {
  const focus = modules[0]?.title || topic.topicName;
  const example = modules.map((m) => m.title).slice(0, 3).join('; ');

  // Topic-specific hooks (unique, not generic)
  const hooks = {
    '1.1': {
      setting: 'A Kenyan kitchen near a dining table with salt, water, and a copper kettle',
      micro: 'Zoom into salt crystal: sodium and chlorine atom-characters linking as NaCl; water molecules as H-O-H',
      experiment: 'Makena labels bottles H2O and NaCl; Jabali almost writes CA for calcium — Dr. Amani corrects to Ca',
      challenge: 'Name one element and one compound you used today',
    },
    '1.2': {
      setting: 'School science corner with ice in a cup and a candle (teacher-supervised)',
      micro: 'Particle animation: solid vibrate, liquid slide, gas fly apart',
      experiment: 'Ice melts (physical) vs paper char demo discussion (chemical) with safety pause',
      challenge: 'Classify melting butter vs burning paper',
    },
    '1.3': {
      setting: 'School assembly point poster and fire extinguisher cabinet',
      micro: 'Fire triangle sides glow: fuel, heat, oxygen; removing one side collapses fire',
      experiment: 'Jabali suggests water on a petrol spill fire — Makena and Dr. Amani stop him and explain Class B',
      challenge: 'Which fire class is burning cardboard?',
    },
    '2.1': {
      setting: 'Lab bench with light microscope and onion slide',
      micro: 'Dive into plant cell: wall, membrane, nucleus, chloroplasts labeled in 3D',
      experiment: 'Calculate magnification: eyepiece ×10 × objective ×40 = ×400 on screen',
      challenge: 'Name two differences between plant and animal cells',
    },
    '2.2': {
      setting: 'Classroom with perfume bottle and a beaker of water + dye',
      micro: 'Diffusion particles spreading; then membrane view for osmosis water arrows',
      experiment: 'Perfume smell race + discussion of wilted vs firm plant tissue',
      challenge: 'One difference between diffusion and osmosis?',
    },
    '2.3': {
      setting: 'Health club classroom with respectful diagram posters',
      micro: 'Simplified reproductive system overview with clear age-appropriate labels',
      experiment: 'Q&A on hygiene, myths vs facts, seeking trusted adults/clinic info',
      challenge: 'State one healthy habit that supports reproductive health',
    },
    '3.1': {
      setting: 'Home evening scene: solar lamp / dry-cell torch',
      micro: 'Energy baton pass: chemical → electrical → light/heat',
      experiment: 'Jabali touches a warm bulb area (safe distance) — heat as energy by-product',
      challenge: 'List the energy chain in a phone torch',
    },
    '3.2': {
      setting: 'School compound path after rain (mud) and a wheelbarrow plank',
      micro: 'Force arrows and area patches; P = F/A appears as HUD overlay',
      experiment: 'Wide bag pads vs thin straps; sharp jembe edge vs blunt edge discussion',
      challenge: 'If force is constant and area halves, what happens to pressure?',
    },
  };

  const h = hooks[topic.topicNumber] || {
    setting: 'Grade 8 classroom in Kenya',
    micro: `Animated breakdown of ${focus}`,
    experiment: `Jabali and Makena test an idea about ${focus} with Dr. Amani guiding safety`,
    challenge: `What is the key idea of ${focus}?`,
  };

  return [
    `### Video Title: ${topic.topicNumber} ${topic.topicName} — ${focus}`,
    '- **Target Audience:** Grade 8 Students',
    '- **Format:** 2D/3D cartoon animation (~3 minutes)',
    '- **Core Characters:**',
    '  - **Dr. Amani** — energetic young scientist guide',
    '  - **Jabali** — curious Grade 8 student',
    '  - **Makena** — curious Grade 8 student',
    `- **Module coverage:** ${example}`,
    '',
    '---',
    '',
    '#### Scene Breakdown',
    '',
    '* **Scene 1: The Hook & Real-World Context (0:00 - 0:30)**',
    `  - **Visual (2D/3D Animation):** ${h.setting}. Camera pans to the object/event linked to ${topic.topicName}.`,
    `  - **Audio / Dialogue:**`,
    `    - Makena: “Dr. Amani, why does this happen in real life?”`,
    `    - Dr. Amani: “Great question — today we unlock ${topic.topicName}.”`,
    '    - SFX: light school ambience, short whoosh into close-up',
    '',
    '* **Scene 2: Zooming into the Invisible / Concept Demonstration (0:30 - 1:30)**',
    `  - **Visual (Microscopic/3D Transition):** ${h.micro}`,
    `  - **Audio / Dialogue:**`,
    `    - Dr. Amani narrates definitions in short lines (no teacher-meta).`,
    `    - Jabali: “So the key words are…” (repeats 2–3 bold terms on screen)`,
    '',
    '* **Scene 3: Real-World Example & Experiment (1:30 - 2:30)**',
    `  - **Visual (2D/3D Animation):** ${h.experiment}`,
    '  - **Audio / Dialogue:**',
    '    - Interactive Q&A between Dr. Amani, Jabali, and Makena',
    '    - On-screen corrections appear when a common mistake is made',
    '',
    '* **Scene 4: Summary Callout & Challenge Question (2:30 - 3:00)**',
    '  - **Visual (Screen Overlay):** 3–5 key terms pop in; challenge question card appears',
    `  - **Audio / Dialogue:**`,
    `    - Dr. Amani: “Your challenge — ${h.challenge}”`,
    '    - Jabali & Makena wave to viewer: “Pause and answer!”',
    '',
    '— CBC Learn · Grade 8 Integrated Science cartoon script',
  ].join('\n');
}

function buildQuiz(topic, pages) {
  const q = [`REVISION QUIZ: ${topic.topicName.toUpperCase()}`, '', 'Use your study module. Show working for calculations.', ''];
  const a = [`ANSWERS: ${topic.topicName.toUpperCase()}`, ''];
  pages.forEach((p, idx) => {
    const n = idx + 1;
    q.push(`${n}. From page “${p.title}”, state two accurate scientific points.`);
    q.push('');
    a.push(`${n}. Award marks for two correct points clearly taken from that page’s concept/examples.`);
    a.push('');
  });
  // add 5 exam-style
  for (let i = 0; i < 5; i += 1) {
    const n = pages.length + 1 + i;
    const prompts = [
      `Explain ${topic.topicName} using one Kenyan example.`,
      `Differentiate two key terms from ${topic.topicName}.`,
      `Write one calculation or formula application from the module (if none, write a definition comparison).`,
      `Describe one safety rule linked to ${topic.topicName}.`,
      `Create one exam question on ${topic.topicName} and answer it.`,
    ];
    q.push(`${n}. ${prompts[i]}`);
    q.push('');
    a.push(`${n}. Mark for scientific accuracy grounded in the study pages.`);
    a.push('');
  }
  return { quiz: q.join('\n'), answers: a.join('\n'), questionCount: pages.length + 5 };
}

function loadIndex() {
  if (!existsSync(INDEX_FILE)) return [];
  return JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
}

function saveRecord(content) {
  mkdirSync(CONTENT_DIR, { recursive: true });
  let index = loadIndex();
  const same = (i) =>
    i.type === content.type &&
    i.topic?.grade === content.topic.grade &&
    /INTEGRATED\s*SCIENCE/i.test(String(i.topic?.subject || '')) &&
    i.topic?.topicNumber === content.topic.topicNumber;

  for (const old of index.filter(same)) {
    const p = join(CONTENT_DIR, `${old.id}.json`);
    if (existsSync(p) && old.id !== content.id) {
      try {
        unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
  index = index.filter((i) => i.id !== content.id && !same(i));
  writeFileSync(join(CONTENT_DIR, `${content.id}.json`), JSON.stringify(content, null, 2));
  index.unshift({
    ...content,
    pages: {
      ...content.pages,
      lesson: (content.pages.lesson || '').slice(0, 240) + '…',
      quiz: content.type === 'video-script' ? (content.pages.quiz || '').slice(0, 220) + '…' : '',
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
  console.error('Missing notes:', NOTES);
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(NOTES, 'utf8'));
console.log(`G8 IS engine v5 — student modules + cartoon video scripts (${catalog.topics.length} topics)`);

for (const topic of catalog.topics) {
  const modules = planModules(topic);
  const studyPages = modules.map((m, i) => buildStudyPage(topic, m, i + 1, modules.length));
  const quizData = buildQuiz(topic, studyPages);
  const videoScript = buildVideoScript(topic, modules);
  const freeCount = LOCK_MODE ? Math.min(FREE_PAGES, studyPages.length) : studyPages.length;

  // Validate uniqueness of practical + visual sections (full blocks, not short prefixes)
  const practicalBlocks = studyPages.map((p) => (p.body.match(/### 2\. Practical Examples[\s\S]*?(?=### 3\.|$)/) || [''])[0].trim());
  const visualBlocks = studyPages.map((p) => (p.body.match(/### 3\. Visual Description[\s\S]*?(?=### 4\.|$)/) || [''])[0].trim());
  const uniquePractical = new Set(practicalBlocks).size;
  const uniqueVisual = new Set(visualBlocks).size;
  if (uniquePractical < studyPages.length || uniqueVisual < studyPages.length) {
    console.error(
      `  ✗ uniqueness fail ${topic.topicNumber}: practical ${uniquePractical}/${studyPages.length}, visual ${uniqueVisual}/${studyPages.length}`,
    );
    process.exitCode = 1;
  }

  const slug = `${String(topic.topicNumber).replace(/\./g, '-')}-${topic.topicName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)}`;

  const lesson = {
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
      lesson: [
        `STUDENT MODULE: ${topic.topicName}`,
        `Grade 8 Integrated Science · ${studyPages.length} consolidated pages`,
        'Format: Concept Overview → Examples & Formulas → Visual Description → Applications & Safety → Practice + Solutions',
        '',
        ...studyPages.map((p) => `Page ${p.pageNumber}: ${p.title}`),
      ].join('\n'),
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
      contentSource: 'g8-is-engine-v5',
      sourceChars: topic.chars,
      freePageCount: freeCount,
      totalStudyPages: studyPages.length,
      lockPages: LOCK_MODE,
      uniquePracticalSections: uniquePractical,
      uniqueVisualSections: uniqueVisual,
      textbookTitles: ['Grade 8 Rationalized Integrated Science Lesson Notes'],
    },
    sources: [
      {
        id: 'g8-is-notes',
        grade: 'grade-8',
        subject: 'INTEGRATED SCIENCE',
        excerpt: (topic.paragraphs || []).slice(0, 3).join(' ').slice(0, 220),
      },
    ],
  };

  saveRecord(lesson);
  saveRecord({
    id: randomUUID(),
    type: 'video-script',
    title: `Video: ${topic.topicName}`,
    topic: lesson.topic,
    pages: { lesson: '', quiz: videoScript, answers: '', studyPages: [] },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: videoScript.split(/\s+/).length,
      reviewed: false,
      access: 'free',
      priceKes: 0,
      contentSource: 'g8-is-engine-v5',
      linkedLessonId: lesson.id,
      videoFormat: '2d-3d-cartoon',
    },
    sources: lesson.sources,
  });

  console.log(
    `  ✓ ${topic.topicNumber} ${topic.topicName}: ${studyPages.length} pages · uniquePractical=${uniquePractical}/${studyPages.length} · uniqueVisual=${uniqueVisual}/${studyPages.length} · video ready`,
  );
}

console.log('\nDone.');
