/**
 * Universal Agent 5 — real exam papers for any CBC grade/subject.
 * Replaces outcome-paste templates ("Learners should ignore…", answer always A).
 */
import { randomUUID } from 'node:crypto';
import { titleBlock, sectionBlock, toUnicodeFormula } from './house-style.mjs';
import { formatWorking } from './math-working.mjs';

export const TIER = {
  general: {
    type: 'exam',
    label: 'General Assessment',
    time: '45 minutes',
    marks: 30,
    mcq: 12,
    short: 4,
    access: 'free',
    priceKes: 0,
  },
  termly: {
    type: 'termly-exam',
    label: 'Termly Exam',
    time: '1 hour 30 minutes',
    marks: 50,
    mcq: 16,
    short: 6,
    access: 'free',
    priceKes: 50,
  },
  mock: {
    type: 'mock-exam',
    label: 'Mock Exam',
    time: '2 hours',
    marks: 80,
    mcq: 24,
    short: 8,
    access: 'paid',
    priceKes: 100,
  },
  premium: {
    type: 'premium-exam',
    label: 'Premium Revision Paper',
    time: '2 hours 30 minutes',
    marks: 100,
    mcq: 30,
    short: 10,
    access: 'paid',
    priceKes: 150,
  },
};

function hash(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0;
  return h;
}

function shuffle(arr, seed) {
  const a = [...arr];
  let s = (seed || 1) >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function mcq(stem, correct, wrongs, seed, working) {
  const choices = shuffle([correct, ...wrongs.slice(0, 3)], seed);
  return {
    stem,
    choices,
    answer: choices.indexOf(correct),
    working: working || null,
    kind: 'mcq',
  };
}

function isMath(subject) {
  return /MATH|NUMERACY|ARITHMETIC/i.test(subject);
}

function family(subject) {
  const s = String(subject || '');
  if (isMath(s)) return 'math';
  if (/BIOLOGY|CHEMISTRY|PHYSICS|SCIENCE|AGRICULTURE|ENVIRONMENT|HOME SCIENCE|MARINE|FISHERIES/i.test(s))
    return 'science';
  if (/ENGLISH|LITERATURE|KISWAHILI|FRENCH|GERMAN|ARABIC|MANDARIN|INDIGENOUS|CHINESE/i.test(s))
    return 'language';
  if (/CHRISTIAN|ISLAMIC|HINDU|RELIGIOUS/i.test(s)) return 're';
  if (/HISTORY|GEOGRAPHY|SOCIAL|CITIZENSHIP|BUSINESS|COMMUNITY/i.test(s)) return 'humanities';
  if (/COMPUTER|ICT|INFORMATION|ELECTRICITY|WOODWORK|METALWORK|BUILDING|AVIATION|POWER|MEDIA|PRE-TECHNICAL/i.test(s))
    return 'tech';
  if (/ART|MUSIC|THEATRE|SPORT|CREATIVE|PHYSICAL EDUCATION|DANCE|FILM/i.test(s)) return 'arts';
  return 'general';
}

/** Build a large unique math MCQ pool for one paper variant */
function mathPool(variant, topics) {
  const items = [];
  const v = variant;

  for (let i = 0; i < 40; i++) {
    const seed = v * 97 + i * 13;
    const kind = (seed + i) % 12;

    if (kind === 0) {
      // Digit 4 in the tens place, e.g. 3ab4c
      const hundreds = 1 + ((seed + i) % 8);
      const ones = 1 + ((seed + i * 3) % 8);
      const num = 3000 + hundreds * 100 + 40 + ones;
      items.push(
        mcq(
          `In the number ${num}, what is the place value of digit 4?`,
          '10',
          ['4', '40', '400'],
          seed,
        ),
      );
    } else if (kind === 1) {
      const a = 24 + ((seed + i) % 30);
      const b = a + 12;
      const g = gcd(a, b);
      items.push(
        mcq(`Find the GCD of ${a} and ${b}.`, String(g), [String(g * 2), String(a), String(Math.max(1, g - 1))], seed),
      );
    } else if (kind === 2) {
      const a = 2 + ((seed + i) % 8);
      const b = 3 + ((seed + i * 2) % 7);
      const product = a * b;
      items.push(
        mcq(`What is ${a} × ${b}?`, String(product), [String(a + b), String(product + 1), String(Math.abs(a - b))], seed, formatWorking({
          formula: 'Product = first factor × second factor',
          substitution: `Product = ${a} × ${b}`,
          steps: [`Product = ${product}`],
          finalAnswer: String(product),
          methodMarks: 'method mark for multiplication; accuracy mark for answer',
        })),
      );
    } else if (kind === 3) {
      const n1 = 1 + ((seed + i) % 3);
      const d1 = 4 + ((seed + i) % 3);
      const n2 = 1 + ((seed + i * 2) % 2);
      const d2 = 2 + ((seed + i) % 3);
      const left = n1 / d1;
      const right = n2 / d2;
      const correct = left > right ? `${n1}/${d1}` : left < right ? `${n2}/${d2}` : 'They are equal';
      items.push(
        mcq(
          `Which is greater: ${n1}/${d1} or ${n2}/${d2}?`,
          correct,
          [`${n1}/${d1}`, `${n2}/${d2}`, 'They are equal', 'Cannot tell'].filter((x) => x !== correct),
          seed,
        ),
      );
    } else if (kind === 4) {
      const x = 5 + ((seed + i) % 10);
      const sq = x * x;
      items.push(
        mcq(`What is the square of ${x}?`, String(sq), [String(x * 2), String(sq + 1), String(x)], seed, formatWorking({
          formula: 'Square = number × number',
          substitution: `${x}² = ${x} × ${x}`,
          steps: [`${x}² = ${sq}`],
          finalAnswer: String(sq),
          methodMarks: 'method mark; accuracy mark',
        })),
      );
    } else if (kind === 5) {
      const perfect = [16, 25, 36, 49, 64, 81, 100][(seed + i) % 7];
      const root = Math.sqrt(perfect);
      items.push(
        mcq(`What is √${perfect}?`, String(root), [String(perfect / 2), String(root + 1), String(perfect)], seed),
      );
    } else if (kind === 6) {
      const side = 6 + ((seed + i) % 9);
      const area = side * side;
      items.push(
        mcq(`A square plot has side ${side} m. What is its area in m²?`, String(area), [String(4 * side), String(side * 2), String(area + side)], seed, formatWorking({
          formula: 'Area of square = side × side',
          substitution: `Area = ${side} × ${side}`,
          steps: [`Area = ${area}`],
          finalAnswer: `${area} m²`,
          methodMarks: 'method mark; accuracy mark',
        })),
      );
    } else if (kind === 7) {
      const L = 8 + ((seed + i) % 8);
      const W = 3 + ((seed + i * 2) % 6);
      const per = 2 * (L + W);
      items.push(
        mcq(`Find the perimeter of a rectangle ${L} cm by ${W} cm.`, String(per), [String(L * W), String(L + W), String(2 * L)], seed, formatWorking({
          formula: 'Perimeter = 2(L + W)',
          substitution: `P = 2(${L} + ${W})`,
          steps: [`P = 2(${L + W})`, `P = ${per}`],
          finalAnswer: `${per} cm`,
          methodMarks: 'method mark; accuracy mark',
        })),
      );
    } else if (kind === 8) {
      const triples = [
        [3, 4, 5],
        [5, 12, 13],
        [6, 8, 10],
        [7, 24, 25],
        [8, 15, 17],
        [9, 12, 15],
        [9, 40, 41],
      ];
      const [a, b, c] = triples[(seed + i) % triples.length];
      const ch = shuffle([String(c), String(a + b), String(c + 2), String(Math.abs(b - a))], seed);
      items.push({
        stem: `In a right-angled triangle, the two shorter sides are ${a} cm and ${b} cm. Find the hypotenuse.`,
        choices: ch,
        answer: ch.indexOf(String(c)),
        working: formatWorking({
          formula: 'c² = a² + b²',
          substitution: `c² = ${a}² + ${b}²`,
          steps: [`c² = ${a * a} + ${b * b}`, `c² = ${a * a + b * b}`, `c = ${c}`],
          finalAnswer: `${c} cm`,
          methodMarks: 'method mark for Pythagoras; accuracy mark for hypotenuse',
        }),
        kind: 'mcq',
      });
    } else if (kind === 9) {
      const k = 3 + ((seed + i) % 6);
      const correct = `${2 * k}x + 2`;
      items.push(mcq(`Simplify ${k}x + 2 + ${k}x.`, correct, [`${k}x + 2`, `${2 * k}x`, `${k}x`], seed));
    } else if (kind === 10) {
      const c = 3 + ((seed + i) % 7);
      const sol = 4 + ((seed + i * 2) % 9);
      const rhs = sol + c;
      items.push(
        mcq(`Solve for x: x + ${c} = ${rhs}.`, String(sol), [String(rhs), String(c), String(sol + 1)], seed, formatWorking({
          formula: 'x = RHS − constant',
          substitution: `x = ${rhs} − ${c}`,
          steps: [`x = ${sol}`],
          finalAnswer: `x = ${sol}`,
          methodMarks: 'method mark; accuracy mark',
        })),
      );
    } else {
      const whole = 12 + ((seed + i) % 20);
      const part = 3 + ((seed + i) % 4);
      const dec = (part / 10).toFixed(1);
      const sum = (whole + Number(dec)).toFixed(1);
      items.push(
        mcq(`Calculate ${whole} + ${dec}.`, sum, [String(whole + part), (whole + Number(dec) + 0.1).toFixed(1), String(whole)], seed),
      );
    }
  }

  // Topic-tagged extras
  for (const t of topics.slice(0, 10)) {
    const name = t.topicName || t.name || '';
    const seed = hash(name) + v;
    if (/fraction/i.test(name)) {
      items.push(mcq('Which fraction is equivalent to 6/8?', '3/4', ['1/2', '2/3', '1/4'], seed));
    } else if (/decimal/i.test(name)) {
      items.push(mcq('What is 1/4 as a decimal?', '0.25', ['0.025', '2.5', '0.205'], seed));
    } else if (/factor/i.test(name)) {
      items.push(mcq('Which list shows all factors of 6?', '1, 2, 3, 6', ['2, 4, 6', '1, 6', '3, 6, 9'], seed));
    } else if (/inequal/i.test(name)) {
      items.push(mcq('Which inequality means “x is greater than 5”?', 'x > 5', ['x < 5', 'x = 5', 'x ≥ 0 only'], seed));
    } else if (/volume|capacity/i.test(name)) {
      items.push(mcq('Volume of a cube of side 3 cm is:', '27 cm³', ['9 cm³', '12 cm³', '18 cm³'], seed));
    } else if (/area/i.test(name)) {
      items.push(mcq('1 hectare equals how many square metres?', '10 000 m²', ['100 m²', '1000 m²', '100 000 m²'], seed));
    }
  }

  return items;
}

function sciencePool(subject, topics, variant) {
  const items = [];
  const bank = [
    mcq('Which change is a physical change?', 'Ice melting to water', ['Paper burning to ash', 'Iron rusting', 'Milk souring'], variant),
    mcq('Diffusion is best described as:', 'Net movement of particles from high to low concentration', ['Movement of water only across a membrane', 'A chemical reaction forming ash', 'Heating until a solid melts'], variant + 1),
    mcq('Why is water unsuitable for a petrol fire?', 'Water can spread burning petrol instead of putting it out safely', ['Water always increases oxygen', 'Petrol fires have no fuel', 'Water removes heat too quickly'], variant + 2),
    mcq('An element is:', 'A pure substance that cannot be broken down into a simpler substance by chemical means', ['Any white crystal used in cooking', 'A mixture of two liquids', 'Any substance that conducts electricity'], variant + 3),
    mcq('Photosynthesis mainly produces:', 'Glucose and oxygen', ['Only carbon dioxide', 'Only water vapour', 'Nitrogen gas only'], variant + 4),
    mcq('The SI unit of force is the:', 'newton (N)', ['joule (J)', 'watt (W)', 'pascal (Pa)'], variant + 5),
    mcq('Soil erosion is reduced by:', 'Planting cover crops and terracing slopes', ['Removing all vegetation', 'Overgrazing continuously', 'Burning crop residue every week'], variant + 6),
    mcq('A compound differs from a mixture because:', 'Elements in a compound are chemically combined in a fixed ratio', ['A compound can be separated by filtering only', 'A mixture always has a fixed melting point', 'Mixtures cannot exist in Kenya'], variant + 7),
    mcq('Boiling point of pure water at standard pressure is about:', '100 °C', ['0 °C', '37 °C', '50 °C'], variant + 8),
    mcq('In a food chain, green plants are usually:', 'Producers', ['Primary consumers only', 'Decomposers only', 'Tertiary consumers'], variant + 9),
  ];
  items.push(...bank);

  topics.slice(0, 12).forEach((t, ti) => {
    const name = t.topicName || t.name || 'this topic';
    const seed = hash(subject + name) + variant + ti * 11;
    items.push(
      mcq(
        `Which practice best shows correct science when studying ${name}?`,
        `Observe carefully, use correct terms, and follow safety rules for ${name}.`,
        [
          `Taste unknown substances to “learn faster” about ${name}.`,
          `Skip labelling diagrams related to ${name}.`,
          `Guess results without recording observations on ${name}.`,
        ],
        seed,
      ),
    );
  });
  return items;
}

function languagePool(subject, topics, variant) {
  const items = [];
  const isKis = /KISWAHILI/i.test(subject);
  if (isKis) {
    items.push(
      mcq('Ni sentensi ipi iliyo sahihi kisarufi?', 'Mwanafunzi anasoma kitabu.', ['Mwanafunzi anasoma vitabu mzuri.', 'Kitabu anasoma mwanafunzi kwa.', 'Anasoma mwanafunzi kitabu ya.'], variant),
      mcq('Kinyume cha “refu” ni:', 'fupi', ['pana', 'nene', 'zito'], variant + 1),
      mcq('Wingi wa “mtoto” ni:', 'watoto', ['mitoto', 'kitoto', 'mato'], variant + 2),
    );
  } else if (/FRENCH/i.test(subject)) {
    items.push(
      mcq('“Bonjour” is used to say:', 'Good morning / hello', ['Good night only', 'Thank you', 'Excuse me'], variant),
      mcq('The French word for “book” is:', 'livre', ['chaise', 'porte', 'fenêtre'], variant + 1),
    );
  } else if (/GERMAN/i.test(subject)) {
    items.push(
      mcq('“Guten Tag” means:', 'Good day / hello', ['Good night', 'Thank you', 'Please'], variant),
      mcq('German for “school” is:', 'Schule', ['Haus', 'Buch', 'Wasser'], variant + 1),
    );
  } else if (/ARABIC|MANDARIN|CHINESE|INDIGENOUS/i.test(subject)) {
    items.push(
      mcq(`In ${subject}, the best classroom habit is:`, 'Practise listening, speaking, reading, and writing every day', ['Only memorise without using the language', 'Avoid speaking to classmates', 'Mix random languages with no purpose'], variant),
    );
  } else {
    items.push(
      mcq('Choose the correctly punctuated sentence.', 'Where is the library?', ['where is the library', 'Where is the library', 'Where is the Library'], variant),
      mcq('A noun is a word that names:', 'A person, place, thing, or idea', ['Only an action', 'Only a describing word', 'Only a joining word'], variant + 1),
      mcq('Which word is a verb?', 'run', ['quickly', 'blue', 'happiness'], variant + 2),
      mcq('The past tense of “go” is:', 'went', ['goed', 'goes', 'going'], variant + 3),
      mcq('A paragraph should usually have:', 'One main idea with supporting sentences', ['Many unrelated topics with no link', 'Only one word repeated', 'No full stops'], variant + 4),
    );
  }

  topics.slice(0, 10).forEach((t, ti) => {
    const name = t.topicName || t.name || 'language skills';
    const seed = hash(subject + name) + variant + ti * 7;
    items.push(
      mcq(
        `When practising ${name}, which approach is best?`,
        `Use clear examples, correct form, and a short local context for ${name}.`,
        [
          `Copy random text without understanding ${name}.`,
          `Avoid reading anything related to ${name}.`,
          `Use insults to “practise” ${name}.`,
        ],
        seed,
      ),
    );
  });
  return items;
}

function rePool(subject, topics, variant) {
  const items = [
    mcq('Respect in religious education is shown by:', 'Listening to others and living values taught at home and school', ['Mocking other people’s beliefs', 'Refusing to help a neighbour', 'Skipping all moral lessons'], variant),
    mcq('A good steward of creation should:', 'Care for the environment and use resources wisely', ['Pollute rivers deliberately', 'Waste food daily', 'Destroy trees without planting'], variant + 1),
    mcq('Honesty means:', 'Telling the truth and keeping trust', ['Cheating in exams', 'Hiding stolen items', 'Spreading rumours'], variant + 2),
  ];
  topics.slice(0, 12).forEach((t, ti) => {
    const name = t.topicName || t.name || 'faith and values';
    const seed = hash(subject + name) + variant + ti * 9;
    items.push(
      mcq(
        `Which response best shows understanding of ${name}?`,
        `Apply the teaching of ${name} with respect, honesty, and care for others in Kenya.`,
        [
          `Use ${name} to insult classmates of other faiths.`,
          `Say ${name} has no place in daily life.`,
          `Ignore safety and kindness while discussing ${name}.`,
        ],
        seed,
      ),
    );
  });
  return items;
}

function humanitiesPool(subject, topics, variant) {
  const items = [
    mcq('A map key (legend) is used to:', 'Explain symbols used on a map', ['Measure rainfall only', 'Replace the compass rose', 'Name the president'], variant),
    mcq('Kenya’s capital city is:', 'Nairobi', ['Mombasa', 'Kisumu', 'Nakuru'], variant + 1),
    mcq('Citizenship responsibility includes:', 'Obeying laws and caring for public property', ['Destroying road signs', 'Avoiding all community work', 'Littering in markets'], variant + 2),
    mcq('A budget helps a family to:', 'Plan income and spending wisely', ['Hide all money underground', 'Avoid saving forever', 'Ignore prices in shops'], variant + 3),
  ];
  topics.slice(0, 12).forEach((t, ti) => {
    const name = t.topicName || t.name || 'this topic';
    const seed = hash(subject + name) + variant + ti * 5;
    items.push(
      mcq(
        `Which statement about ${name} is most accurate for CBC learning?`,
        `Explain ${name} with correct facts and a clear Kenyan example.`,
        [
          `Treat ${name} as rumours only.`,
          `Say ${name} never happens in Kenya.`,
          `Skip evidence when discussing ${name}.`,
        ],
        seed,
      ),
    );
  });
  return items;
}

function techPool(subject, topics, variant) {
  const items = [
    mcq('Before using a sharp tool in a workshop, you should:', 'Wear safety gear and follow instructions', ['Run with the tool', 'Remove all guards', 'Work alone with eyes closed'], variant),
    mcq('A computer’s main brain for processing is the:', 'CPU', ['Monitor', 'Keyboard', 'Speaker'], variant + 1),
    mcq('ICT stands for:', 'Information and Communication Technology', ['Internal Cooking Timer', 'International Cricket Team', 'Input Cable Tester'], variant + 2),
    mcq('Electricity safety rule:', 'Never touch live wires with wet hands', ['Insert metal objects into sockets for fun', 'Ignore burnt cables', 'Overload every socket'], variant + 3),
  ];
  topics.slice(0, 12).forEach((t, ti) => {
    const name = t.topicName || t.name || 'this skill';
    const seed = hash(subject + name) + variant + ti * 3;
    items.push(
      mcq(
        `When learning ${name}, the safest correct step is:`,
        `Follow procedure, use tools correctly, and check safety for ${name}.`,
        [
          `Skip safety briefings for ${name}.`,
          `Guess wiring or cutting steps for ${name}.`,
          `Leave sharp tools on the floor after ${name}.`,
        ],
        seed,
      ),
    );
  });
  return items;
}

function artsPool(subject, topics, variant) {
  const items = [
    mcq('Primary colours are:', 'Red, blue, and yellow', ['Green, orange, and purple', 'Black, white, and grey', 'Brown, pink, and gold'], variant),
    mcq('Warming up before sport helps to:', 'Prepare muscles and reduce injury risk', ['Guarantee a trophy', 'Replace drinking water', 'Remove the need for rules'], variant + 1),
    mcq('In music, tempo refers to:', 'The speed of the music', ['Only the volume', 'Only the costume', 'The ticket price'], variant + 2),
  ];
  topics.slice(0, 12).forEach((t, ti) => {
    const name = t.topicName || t.name || 'creative practice';
    const seed = hash(subject + name) + variant + ti * 4;
    items.push(
      mcq(
        `Best practice when working on ${name}:`,
        `Practise ${name} with discipline, creativity, and respect for others.`,
        [
          `Disrupt classmates during ${name}.`,
          `Damage equipment used for ${name}.`,
          `Refuse all feedback on ${name}.`,
        ],
        seed,
      ),
    );
  });
  return items;
}

function generalPool(subject, topics, variant) {
  const items = [];
  topics.slice(0, 16).forEach((t, ti) => {
    const name = t.topicName || t.name || 'this topic';
    const seed = hash(subject + name) + variant + ti * 17;
    items.push(
      mcq(
        `Which option best shows correct understanding of ${name}?`,
        `Apply ${name} with accurate facts in a Kenyan home, school, or community situation.`,
        [
          `Treat ${name} as empty slogans with no facts.`,
          `Copy a rumour about ${name} without checking.`,
          `Use ${name} to shame classmates.`,
        ],
        seed,
      ),
    );
  });
  if (!items.length) {
    items.push(
      mcq(
        `Which habit supports success in ${subject}?`,
        'Revise regularly, practise skills, and check answers with working or evidence',
        ['Never revise', 'Guess every answer without thinking', 'Hide mistakes from yourself forever'],
        variant,
      ),
    );
  }
  return items;
}

function buildMcqPool(subject, topics, variant) {
  const f = family(subject);
  if (f === 'math') return mathPool(variant, topics);
  if (f === 'science') return sciencePool(subject, topics, variant);
  if (f === 'language') return languagePool(subject, topics, variant);
  if (f === 're') return rePool(subject, topics, variant);
  if (f === 'humanities') return humanitiesPool(subject, topics, variant);
  if (f === 'tech') return techPool(subject, topics, variant);
  if (f === 'arts') return artsPool(subject, topics, variant);
  return generalPool(subject, topics, variant);
}

function shortItems(subject, topics, variant, count) {
  const names = topics.map((t) => t.topicName || t.name).filter(Boolean);
  const out = [];
  for (let i = 0; i < count; i++) {
    const topic = names.length ? names[(i + variant) % names.length] : subject;
    if (isMath(subject)) {
      const n = 12 + ((variant + i) % 8);
      const p = 50 + ((variant + i) % 10) * 5;
      out.push({
        stem: `Show full working: A trader sells ${n} items at Ksh ${p} each. Find the total money collected.`,
        answer: formatWorking({
          formula: 'Total = number × price each',
          substitution: `Total = ${n} × ${p}`,
          steps: [`Total = ${n * p}`],
          finalAnswer: `Ksh ${n * p}`,
          methodMarks: 'method mark; accuracy mark',
        }),
        marks: 4,
      });
    } else {
      out.push({
        stem: `In three clear sentences, explain ${topic} and give one Kenyan example.`,
        answer: `Award marks for: (1) accurate definition/idea of ${topic}; (2) correct use of subject terms; (3) a relevant local example (home, school, market, farm, or community). Do not award for slogans with no content.`,
        marks: 4,
      });
    }
  }
  return out;
}

function examBody(grade) {
  if (/grade-[789]$/i.test(grade)) return 'KJSEA';
  if (/grade-1[0-2]/i.test(grade)) return 'KNEC / KCSE pathway';
  return 'KPSEA';
}

export function generateUniversalPaper({
  grade,
  gradeLabel,
  subject,
  topics = [],
  category,
  paperIndex,
  term = null,
}) {
  const meta = TIER[category];
  if (!meta) throw new Error(`Unknown category: ${category}`);
  const variant = paperIndex * 13 + hash(`${subject}|${grade}|${category}`);

  let pool = buildMcqPool(subject, topics, variant);
  while (pool.length < meta.mcq * 2) {
    pool = pool.concat(buildMcqPool(subject, topics, variant + pool.length + 50));
  }
  const seen = new Set();
  const unique = [];
  for (const q of shuffle(pool, variant + 99)) {
    if (seen.has(q.stem)) continue;
    seen.add(q.stem);
    unique.push(q);
    if (unique.length >= meta.mcq) break;
  }
  let guard = 0;
  while (unique.length < meta.mcq && guard < 20) {
    guard++;
    for (const q of buildMcqPool(subject, topics, variant + 700 + guard * 17 + unique.length)) {
      if (seen.has(q.stem)) continue;
      seen.add(q.stem);
      unique.push(q);
      if (unique.length >= meta.mcq) break;
    }
  }
  const mcqs = unique.slice(0, meta.mcq);
  // Re-shuffle each question’s choices with distinct seed so answer letter rotates
  const rotated = mcqs.map((q, i) => {
    const correct = q.choices[q.answer];
    const choices = shuffle(q.choices, variant + i * 31 + 7);
    return { ...q, choices, answer: choices.indexOf(correct) };
  });

  const shorts = shortItems(subject, topics, variant, meta.short);

  const paper = [
    titleBlock(`${subject} — ${meta.label} #${paperIndex + 1}`),
    '',
    `GRADE: ${gradeLabel}`,
    `SUBJECT: ${subject}`,
    term ? `TERM: ${term}` : null,
    `TIME ALLOWED: ${meta.time}`,
    `TOTAL MARKS: ${meta.marks}`,
    `EXAM BODY: ${examBody(grade)}`,
    '',
    sectionBlock('INSTRUCTIONS'),
    '1. Answer all questions.',
    '2. For calculations, show formula → substitution → steps → final answer with units.',
    '3. For multiple choice, choose the best option.',
    '4. Check your work before submitting.',
    '',
    sectionBlock('SECTION A — MULTIPLE CHOICE'),
  ].filter((x) => x !== null);

  const scheme = [titleBlock('MARKING SCHEME'), ''];

  rotated.forEach((q, idx) => {
    const n = idx + 1;
    paper.push(`${n}. ${q.stem} (1 mark)`);
    q.choices.forEach((c, i) => paper.push(`   ${String.fromCharCode(65 + i)}. ${toUnicodeFormula(c)}`));
    paper.push('');
    scheme.push(`${n}. ${String.fromCharCode(65 + q.answer)} — ${toUnicodeFormula(q.choices[q.answer])}`);
    if (q.working) scheme.push(q.working);
    scheme.push('');
  });

  paper.push(sectionBlock('SECTION B — STRUCTURED / SHORT ANSWERS'));
  shorts.forEach((q, idx) => {
    const n = rotated.length + idx + 1;
    paper.push(`${n}. ${q.stem} (${q.marks} marks)`);
    paper.push('');
    scheme.push(`${n}. (${q.marks} marks)`);
    scheme.push(toUnicodeFormula(q.answer));
    scheme.push('');
  });

  const quiz = paper.join('\n');
  const answers = scheme.join('\n');

  if (/Learners should ignore|only useful outside Kenya|no need to practise/i.test(quiz + answers)) {
    throw new Error(`Banned template language leaked into ${subject} ${category} #${paperIndex + 1}`);
  }

  // Correct letters must not all be A — force one more rotation if needed
  if (rotated.length && rotated.every((q) => q.answer === 0)) {
    rotated.forEach((q, i) => {
      if (i % 2 === 0 && q.choices.length > 1) {
        const correct = q.choices[0];
        const choices = [...q.choices.slice(1), correct];
        q.choices = choices;
        q.answer = choices.indexOf(correct);
      }
    });
  }

  return {
    id: randomUUID(),
    type: meta.type,
    title: `${gradeLabel} ${subject} — ${meta.label} #${paperIndex + 1}`,
    topic: {
      grade,
      gradeLabel,
      subject,
      topicNumber: term ? `T${term}` : category,
      topicOrder: paperIndex + 1,
      slug: `${grade}-${subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${category}-${paperIndex + 1}`,
    },
    pages: { lesson: '', quiz, answers, studyPages: [] },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: quiz.split(/\s+/).length,
      reviewed: true,
      access: meta.access,
      priceKes: meta.priceKes,
      questionCount: rotated.length + shorts.length,
      category,
      term,
      contentSource: 'universal-exam-v1',
      sourceStrategy: 'universal-agent-5',
      paperTier: category.toUpperCase(),
      paperIndex: paperIndex + 1,
      totalMarks: meta.marks,
      engine: 'universal-agent-5',
    },
    sources: [
      {
        id: 'curriculum-index',
        grade,
        subject,
        excerpt: `CBC topics: ${topics
          .slice(0, 6)
          .map((t) => t.topicName || t.name)
          .filter(Boolean)
          .join(', ')}`,
      },
    ],
  };
}
