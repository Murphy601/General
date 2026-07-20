/**
 * Classroom-style CBC study lessons from KICD outcomes (Strategy 2).
 *
 * Format rules:
 * - Point form (bullets), not long paragraphs
 * - Teach → Worked example → Try this (for every skill)
 * - Real calculations / concrete models
 * - Never dump radio scripts or curriculum tables
 */

import { displayTopicName } from './curriculum-source.mjs';

function cleanText(s) {
  return String(s || '')
    .replace(/\r/g, '')
    .replace(/\f/g, '\n')
    .replace(/Page \d+ of \d+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function flatten(s) {
  return cleanText(s).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function topicTitle(topic) {
  return displayTopicName(topic.topicName || topic.subStrand || 'this topic');
}

function tidyOutcome(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\b[a-f]\)\s*[a-f]\)\s*/gi, '')
    .replace(/\s*Core Competen.*$/i, '')
    .replace(/\s*Link to.*$/i, '')
    .replace(/\s*Suggested.*$/i, '')
    .replace(/\s*\d+\)\s*(?:What|Why|How|Which).*$/i, '')
    .replace(/\s+Page\s+\d+(\s+of\s+\d+)?$/i, '')
    .trim()
    .replace(/[.,;]+$/, '');
}

function isCleanOutcome(text) {
  const t = String(text || '').trim();
  if (t.length < 18 || t.length > 220) return false;
  if (/\?/.test(t)) return false;
  if (/you make|from a effective|grade words using/i.test(t)) return false;
  if (t.split(/\s+/).length < 5) return false;
  return true;
}

function parseSlos(rawText) {
  const flat = flatten(rawText);
  const items = [];
  const re =
    /\b([a-f])\)\s*((?:multiply|divide|add|subtract|count|estimate|create|appreciate|read|write|listen|speak|identify|recognise|recognize|enjoy|use|demonstrate|apply|explain|describe|draw|sing|practise|practice|show|name|state|discuss|perform|compose|observe|compare|sort|match|recite|pray|follow|respond|answer|ask|retell|punctuate|spell|form|join|copy|trace|calculate|measure|solve|find|compute|group|classify|conserve|care|wash|share|obey|respect|tell|say|greet|construct|model|imitate|dramatise|dramatize|value|order|sequence|role[\s-]?play|plant)[\s\S]{10,220}?)(?=\s*[a-f]\)\s*(?:[a-z]|Core|Link|Suggested|Assessment)|Core Competenc|Link to Values|Suggested [Ll]earning|The learner is guided|Assessment Rubric|$)/gi;
  let m;
  while ((m = re.exec(flat)) !== null) {
    let text = tidyOutcome(m[2]);
    if (text.length > 160) {
      const cut = text.search(/\s+(?:The learner is guided|Learners?|What |Why |How )/i);
      if (cut > 40) text = text.slice(0, cut).trim();
    }
    if (isCleanOutcome(text)) items.push({ letter: m[1].toLowerCase(), text });
    if (items.length >= 8) break;
  }
  return items;
}

function parseInquiryQuestions(rawText) {
  const flat = flatten(rawText);
  const found = [];
  const re = /\b((?:How|Why|What|Which|When|Where)[^?]{3,110}\?)/gi;
  let m;
  while ((m = re.exec(flat)) !== null) {
    const q = m[1].replace(/\s+/g, ' ').trim().replace(/^(\d+\.\s*)+/, '');
    if (!/assessment|rubric|learners are guided/i.test(q)) found.push(q);
    if (found.length >= 4) break;
  }
  return [...new Set(found)];
}

function bullets(...items) {
  return items.filter(Boolean).map((x) => (String(x).startsWith('•') || String(x).startsWith('  ') ? x : `• ${x}`));
}

function skillBlock({ title, teach, worked, tryThis, answer }) {
  const lines = [];
  lines.push(`▸ ${title}`);
  lines.push('');
  lines.push('Teach');
  for (const t of teach) lines.push(`• ${t}`);
  lines.push('');
  lines.push('Worked example');
  for (const w of worked) lines.push(`• ${w}`);
  lines.push('');
  lines.push('Try this');
  for (const t of tryThis) lines.push(`• ${t}`);
  if (answer) {
    lines.push(`• (Check later: ${answer})`);
  }
  lines.push('');
  return lines;
}

/* -------------------- MATH CLASSROOM PACKS -------------------- */

function mathPlaneFiguresPack(title) {
  return {
    outcomes: [
      'identify common plane figures (square, rectangle, triangle, circle)',
      'tell the difference between regular and irregular shapes',
      'find the perimeter of a rectangle by adding all sides',
      'find the perimeter of a square by adding all sides (or 4 × side)',
      'use cm and m correctly when measuring length',
    ],
    study: [
      '▸ What is a plane figure?',
      '',
      ...bullets(
        'A plane figure is a flat shape.',
        'It has length and width, but not thickness you can hold like a box.',
        'Common plane figures: square, rectangle, triangle, circle.',
      ),
      '',
      '▸ Regular and irregular shapes',
      '',
      ...bullets(
        'Regular shapes have a clear, definite figure (square, rectangle, equilateral triangle, circle).',
        'Irregular shapes do not look the same on all sides / do not follow one simple equal-side rule.',
        'Kenyan look-around examples of rectangles: exercise book, door, window, TV screen, table top.',
        'Kenyan look-around examples of squares: some stools, tiles, window panes, pillows.',
      ),
      '',
      ...skillBlock({
        title: 'Units of length (revision)',
        teach: [
          'We measure length in centimetres (cm) and metres (m).',
          '1 m = 100 cm.',
          'To change m → cm: multiply by 100.',
          'To change cm → m: divide by 100.',
        ],
        worked: [
          '9 m to cm → 9 × 100 = 900 cm.',
          '590 cm to m → 590 ÷ 100 = 5 m 90 cm.',
        ],
        tryThis: ['Convert 3 m to cm.', 'Convert 250 cm to m and cm.'],
        answer: '3 m = 300 cm; 250 cm = 2 m 50 cm',
      }),
      ...skillBlock({
        title: 'What is perimeter?',
        teach: [
          'Perimeter = the distance all the way round a closed shape.',
          'Start at one point, go round every side, return to the start.',
          'For any polygon: add the lengths of all sides.',
        ],
        worked: [
          'A triangular flower bed has sides 3 m, 4 m, and 5 m.',
          'Perimeter = 3 + 4 + 5 = 12 m.',
        ],
        tryThis: ['Sides 2 m, 6 m, 7 m. Find the perimeter.'],
        answer: '15 m',
      }),
      ...skillBlock({
        title: 'Perimeter of a rectangle',
        teach: [
          'A rectangle has 4 sides.',
          'Opposite sides are equal: two lengths (L) and two widths (W).',
          'Perimeter = L + W + L + W.',
          'Or: Perimeter = 2 × (L + W).',
        ],
        worked: [
          'Exercise book: L = 18 cm, W = 13 cm.',
          'P = 18 + 13 + 18 + 13.',
          '18 + 13 = 31, then 31 + 18 = 49, then 49 + 13 = 62.',
          'Perimeter = 62 cm.',
          'Check with formula: 2 × (18 + 13) = 2 × 31 = 62 cm.',
        ],
        tryThis: [
          'Door: L = 200 cm, W = 100 cm. Find the perimeter.',
          'Classroom board: L = 240 cm, W = 120 cm. Find the perimeter.',
        ],
        answer: 'Door P = 600 cm; board P = 720 cm',
      }),
      ...skillBlock({
        title: 'Perimeter of a square',
        teach: [
          'A square has 4 equal sides.',
          'Perimeter = side + side + side + side.',
          'Or: Perimeter = 4 × side.',
        ],
        worked: [
          'A square tile has side 15 cm.',
          'P = 4 × 15 = 60 cm.',
        ],
        tryThis: ['Square handkerchief side 25 cm. Find P.', 'Square garden side 8 m. Find P.'],
        answer: '100 cm; 32 m',
      }),
      '▸ Irregular shapes',
      '',
      ...bullets(
        'Measure (or read) every side.',
        'Add all sides carefully.',
        'Keep the same unit (all cm, or all m).',
      ),
      '',
      'Worked example — irregular 5-sided plot',
      ...bullets(
        'Sides: 4 m, 3 m, 5 m, 2 m, 6 m.',
        'P = 4 + 3 + 5 + 2 + 6 = 20 m.',
      ),
      '',
    ],
    examples: [
      'Rectangle book: 18 cm × 13 cm → P = 62 cm.',
      'Door: 200 cm × 100 cm → P = 600 cm.',
      'Square tile side 15 cm → P = 60 cm.',
      '9 m = 900 cm; 590 cm = 5 m 90 cm.',
    ],
    practice: [
      'Find P of a rectangle 16 cm by 9 cm. Show both addition and 2(L+W).',
      'Find P of a square of side 12 cm.',
      'Convert 7 m to cm, then find P of a square of side 7 m in cm.',
      'An irregular shape has sides 10 cm, 8 cm, 6 cm, 8 cm, 10 cm. Find P.',
      'Word problem: A rectangular classroom is 9 m by 6 m. What length of skirting board is needed to go all round?',
    ],
    work: [
      'Measure a book, a phone, or a desk top with a ruler. Record L and W. Calculate perimeter.',
      'Draw 1 rectangle, 1 square, and 1 irregular shape. Label sides. Find each perimeter.',
      'Write 5 perimeter questions for a friend. Then mark them.',
    ],
    remember: [
      'Perimeter = distance round a closed shape.',
      'Rectangle: P = 2(L + W).',
      'Square: P = 4 × side.',
      'Always use the same units (cm or m).',
    ],
    inquiry: ['What is the difference between regular and irregular shapes?', 'How do we find perimeter?'],
    quizFacts: [
      'Perimeter is the distance round a closed figure',
      'Rectangle opposite sides are equal',
      'Book 18 cm by 13 cm has perimeter 62 cm',
      'Door 200 cm by 100 cm has perimeter 600 cm',
      'Square perimeter = 4 × side',
      '1 m = 100 cm',
      '9 m = 900 cm',
      'P = 2(L + W) for a rectangle',
    ],
  };
}

function mathMultiplicationPack() {
  return {
    outcomes: [
      'Multiply up to a two-digit number by multiples of 10',
      'Multiply up to a two-digit number by a two-digit number, with and without regrouping',
      'Multiply up to a two-digit number by 100',
      'Estimate products by rounding to the nearest 10',
      'Create multiplication patterns with products not more than 100',
    ],
    study: [
      '▸ What multiplication means',
      '',
      ...bullets(
        'Multiplication is repeated addition.',
        '4 × 3 means 4 + 4 + 4 = 12.',
        'Kenya uses: market prices, equal rows of desks, garden plots.',
      ),
      '',
      ...skillBlock({
        title: 'Multiply by multiples of 10',
        teach: [
          'Multiply the non-zero parts, then add the zero(s) from the multiple of 10.',
        ],
        worked: [
          '24 × 10 → 24 × 1 = 24, add one zero → 240.',
          '36 × 20 → 36 × 2 = 72, add one zero → 720.',
          '45 × 30 → 45 × 3 = 135, add one zero → 1,350.',
        ],
        tryThis: ['16 × 10', '25 × 20', '33 × 30'],
        answer: '160; 500; 990',
      }),
      ...skillBlock({
        title: 'Two-digit × two-digit (break-up method)',
        teach: [
          'Break the second number into tens + ones.',
          'Multiply each part, then add.',
        ],
        worked: [
          '23 × 14',
          '14 = 10 + 4',
          '23 × 10 = 230',
          '23 × 4 = 92',
          '230 + 92 = 322',
        ],
        tryThis: ['12 × 13', '27 × 15'],
        answer: '156; 405',
      }),
      ...skillBlock({
        title: 'Multiply by 100',
        teach: ['Write the number, then add two zeros.'],
        worked: ['18 × 100 = 1,800', '42 × 100 = 4,200'],
        tryThis: ['7 × 100', '35 × 100'],
        answer: '700; 3,500',
      }),
      ...skillBlock({
        title: 'Estimate by rounding to 10',
        teach: [
          'Round each factor to the nearest 10.',
          'Multiply the rounded numbers.',
        ],
        worked: [
          'Estimate 48 × 19',
          '48 → 50, 19 → 20',
          '50 × 20 = 1,000 (estimate)',
        ],
        tryThis: ['Estimate 34 × 22'],
        answer: 'about 600 (30 × 20)',
      }),
    ],
    examples: [
      '24 × 10 = 240',
      '23 × 14 = 322',
      '18 × 100 = 1,800',
      '48 × 19 ≈ 1,000',
    ],
    practice: [
      'Work out: 16 × 10, 25 × 20, 33 × 30.',
      'Work out: 23 × 14 and 27 × 15. Show break-up.',
      'Work out: 18 × 100 and 42 × 100.',
      'Estimate: 48 × 19 and 34 × 22.',
      'Word problem: One book costs KSh 35. Cost of 10 books?',
    ],
    work: [
      'Write and solve 10 mixed multiplication questions in your book.',
      'Make a ×12 chart from 12 × 1 to 12 × 10.',
      'Invent one market word problem and solve it.',
    ],
    remember: [
      '×10 → add one zero; ×100 → add two zeros.',
      'Break 2-digit multipliers into tens + ones.',
      'Estimate by rounding to 10, then multiply.',
    ],
    inquiry: ['When can you use multiplication in real life?'],
    quizFacts: [
      '24 × 10 = 240',
      '36 × 20 = 720',
      '23 × 14 = 322',
      '18 × 100 = 1,800',
      '48 × 19 ≈ 50 × 20 = 1,000',
    ],
  };
}

function mathAreaPack() {
  return {
    outcomes: [
      'explain area as the space covered by a flat shape',
      'find area of a rectangle using length × width',
      'find area of a square using side × side',
      'use square centimetres (cm²) or square metres (m²)',
    ],
    study: [
      '▸ What is area?',
      '',
      ...bullets(
        'Area is the amount of flat space a shape covers.',
        'We measure area in cm² or m².',
      ),
      '',
      ...skillBlock({
        title: 'Area of a rectangle',
        teach: [
          'Area = Length × Width.',
          'Both sides must use the same unit first.',
        ],
        worked: [
          'A book cover is 18 cm by 13 cm.',
          'Area = 18 × 13.',
          '18 × 10 = 180, 18 × 3 = 54, total 234.',
          'Area = 234 cm².',
        ],
        tryThis: ['Rectangle 10 cm by 7 cm. Find area.', 'Classroom floor 9 m by 6 m. Find area.'],
        answer: '70 cm²; 54 m²',
      }),
      ...skillBlock({
        title: 'Area of a square',
        teach: ['Area = side × side.'],
        worked: ['Square tile side 15 cm → Area = 15 × 15 = 225 cm².'],
        tryThis: ['Square side 8 cm. Find area.', 'Square garden side 5 m. Find area.'],
        answer: '64 cm²; 25 m²',
      }),
    ],
    examples: ['18 × 13 = 234 cm²', '15 × 15 = 225 cm²', '9 × 6 = 54 m²'],
    practice: [
      'Find area: 12 cm by 5 cm rectangle.',
      'Find area: square side 9 cm.',
      'Word problem: A rectangular plot is 20 m by 15 m. Find its area.',
    ],
    work: ['Measure a book and calculate its area.', 'Draw 2 shapes, label sides, find area.'],
    remember: ['Area = space covered.', 'Rectangle: L × W.', 'Square: side × side.', 'Use cm² or m².'],
    inquiry: ['How is area different from perimeter?'],
    quizFacts: [
      'Area is the space a flat shape covers',
      'Rectangle area = length × width',
      '18 × 13 = 234 cm²',
      'Square area = side × side',
      '15 × 15 = 225 cm²',
    ],
  };
}

function buildMathPack(topic) {
  const title = topicTitle(topic);
  const blob = `${title} ${topic.topicNumber || ''}`.toLowerCase();
  if (/^area\b|\barea\b/.test(blob) && !/plane|figur|perimet/.test(blob)) return mathAreaPack();
  if (/plane|figur|perimet|geometry|rectangle|square|triangle/.test(blob) && !/^area\b/.test(blob)) {
    return mathPlaneFiguresPack(title);
  }
  if (/multipl/.test(blob)) return mathMultiplicationPack();
  if (/divis/.test(blob)) {
    return {
      outcomes: ['divide equal groups', 'check division by multiplying'],
      study: skillBlock({
        title: 'Division',
        teach: [
          'Division shares a total into equal groups.',
          'Check by multiplying: if 24 ÷ 6 = 4, then 6 × 4 = 24.',
        ],
        worked: ['24 ÷ 6 = 4', '36 ÷ 4 = 9', '45 ÷ 5 = 9'],
        tryThis: ['18 ÷ 3', '40 ÷ 8', 'Share 30 books among 5 learners'],
        answer: '6; 5; 6 each',
      }),
      examples: ['24 ÷ 6 = 4', '36 ÷ 4 = 9', '30 ÷ 5 = 6'],
      practice: ['Work out 18 ÷ 3, 28 ÷ 7, 40 ÷ 8. Multiply to check.'],
      work: ['Write 8 division questions and mark them.'],
      remember: ['Division undoes multiplication.', 'Always check by multiplying.'],
      inquiry: [],
      quizFacts: ['24 ÷ 6 = 4', '36 ÷ 4 = 9', 'Check division by multiplying'],
    };
  }
  if (/add/.test(blob)) {
    return {
      outcomes: ['add with and without regrouping'],
      study: skillBlock({
        title: 'Addition',
        teach: ['Align ones under ones, tens under tens.', 'Add from the right.'],
        worked: ['23 + 14 = 37', '28 + 17 = 45 (regroup ones)', 'KSh 45 + KSh 30 = KSh 75'],
        tryThis: ['46 + 12', '39 + 28'],
        answer: '58; 67',
      }),
      examples: ['23 + 14 = 37', '28 + 17 = 45'],
      practice: ['Solve five addition questions showing working.'],
      work: ['Make a market addition word problem and solve it.'],
      remember: ['Add from the ones column first.'],
      inquiry: [],
      quizFacts: ['23 + 14 = 37', '28 + 17 = 45'],
    };
  }
  if (/subtract|minus/.test(blob)) {
    return {
      outcomes: ['subtract with and without regrouping'],
      study: skillBlock({
        title: 'Subtraction',
        teach: ['Subtraction finds what is left or the difference.'],
        worked: ['48 − 23 = 25', '52 − 18 = 34', 'KSh 100 − KSh 35 = KSh 65'],
        tryThis: ['67 − 21', '80 − 46'],
        answer: '46; 34',
      }),
      examples: ['48 − 23 = 25', '52 − 18 = 34'],
      practice: ['Solve five subtraction questions showing working.'],
      work: ['Write change problems using shillings.'],
      remember: ['Regroup when ones are not enough.'],
      inquiry: [],
      quizFacts: ['48 − 23 = 25', '52 − 18 = 34'],
    };
  }
  if (/fraction/.test(blob)) {
    return {
      outcomes: ['explain equal parts of a whole', 'find simple fractions of amounts'],
      study: skillBlock({
        title: 'Fractions',
        teach: [
          'A fraction names equal parts of a whole.',
          'In 1/2, the whole is split into 2 equal parts; you take 1.',
        ],
        worked: ['1/2 of 12 mangoes = 6', '1/4 of 20 = 5', '3/4 means 3 equal parts out of 4'],
        tryThis: ['1/2 of 10', '1/4 of 16'],
        answer: '5; 4',
      }),
      examples: ['1/2 of 12 = 6', '1/4 of 20 = 5'],
      practice: ['Find 1/2 and 1/4 of classroom totals (learners, desks).'],
      work: ['Draw shapes and shade 1/2 and 1/4.'],
      remember: ['Denominator = equal parts of the whole.'],
      inquiry: [],
      quizFacts: ['1/2 of 12 = 6', '1/4 of 20 = 5'],
    };
  }

  // Generic maths classroom shell with forced calculation practice
  return {
    outcomes: [`solve questions on ${title}`, `show clear working for ${title}`],
    study: [
      `▸ Learning ${title}`,
      '',
      ...bullets(
        `Read the meaning of ${title}.`,
        'Copy every worked example into your book.',
        'Then solve the Try this questions without looking.',
      ),
      '',
      ...skillBlock({
        title: title,
        teach: [
          `Use objects, drawings, or place value to understand ${title}.`,
          'Write each step. Box the final answer.',
        ],
        worked: [
          `Model question on ${title}: write the question.`,
          'Step 1: …',
          'Step 2: …',
          'Answer: …',
          '(Your teacher/parent can replace this with the class example.)',
        ],
        tryThis: [
          `Invent 3 ${title} questions using Kenyan shillings, metres, or classroom counts.`,
          'Solve all three and show working.',
        ],
      }),
    ],
    examples: [`Show working for one ${title} question.`, `Check with a second method.`],
    practice: [`Solve 8 practice questions on ${title}.`, 'Mark and correct mistakes.'],
    work: [`Make a revision sheet for ${title} with 5 worked examples.`],
    remember: ['Show working.', 'Check every answer.'],
    inquiry: [],
    quizFacts: [`${title} needs clear step-by-step working`, 'Always check your answer'],
  };
}

/* -------------------- ENGLISH / LITERACY -------------------- */

function englishPack(topic, outcomes) {
  const title = topicTitle(topic);
  const name = title.toLowerCase();

  if (/euphemism|polite|short forms|oral literature|riddl|proverb|tongue/.test(name) || /euphemism/.test(outcomes.join(' '))) {
    return {
      outcomes: outcomes.length
        ? outcomes
        : ['use euphemisms to show politeness', 'identify short forms in oral literature', 'speak politely in public'],
      study: [
        '▸ What is a euphemism?',
        '',
        ...bullets(
          'A euphemism is a soft / polite way of saying something that might sound harsh or embarrassing.',
          'We use euphemisms to show respect and good manners.',
        ),
        '',
        ...skillBlock({
          title: 'Euphemism for politeness',
          teach: [
            'Think of the direct word.',
            'Replace it with a kinder phrase.',
            'Keep the meaning, soften the sound.',
          ],
          worked: [
            'Direct: “He died.” → Polite: “He passed away.”',
            'Direct: “She is old.” → Polite: “She is advanced in age.” / “She is elderly.”',
            'Direct: “The toilet” in formal talk → Polite: “the washroom” / “the restroom”.',
            'Direct: “You failed.” → Polite: “You did not meet the mark this time.”',
          ],
          tryThis: [
            'Change to polite language: “Your breath smells.”',
            'Change to polite language: “That man is jobless.”',
          ],
          answer: 'e.g. “Your breath is not fresh.”; “He is between jobs / seeking employment.”',
        }),
        '▸ Short forms in oral literature (examples)',
        '',
        ...bullets(
          'Riddles — short clever questions for entertainment and thinking.',
          'Proverbs — short wise sayings.',
          'Tongue twisters — short phrases for clear speech practice.',
        ),
        '',
        'Worked examples',
        ...bullets(
          'Proverb idea: “A stitch in time saves nine.” → Fix a small problem early.',
          'Polite classroom talk: “Please may I borrow your pen?” not “Give me your pen.”',
        ),
        '',
      ],
      examples: [
        '“passed away” instead of “died”',
        '“washroom” instead of blunt toilet talk in formal settings',
        '“Please may I…?” for polite requests',
      ],
      practice: [
        'Write 5 direct sentences, then rewrite each with a euphemism / polite form.',
        'Role-play a market conversation using polite requests.',
        'Explain why polite language matters in school assemblies.',
      ],
      work: [
        'Collect 5 euphemisms from home/radio/news. Write direct + polite pairs.',
        'Prepare a 1-minute polite speech thanking visitors at school.',
      ],
      remember: [
        'Euphemism = softer polite wording.',
        'Polite language shows respect.',
        'Practise short oral forms: riddles, proverbs, polite requests.',
      ],
      inquiry: ['Why should we use polite language?', 'Why is it embarrassing to say some words in public?'],
      quizFacts: [
        'Euphemism is a polite soft expression',
        '“Passed away” is a euphemism for died',
        'Polite requests use words like please and may I',
        'Short oral forms include riddles and proverbs',
      ],
    };
  }

  if (/word reading|sight word|vocabulary|word attack/.test(name)) {
    return {
      outcomes: [
        'read longer words using look-and-say',
        'chunk long words into parts',
        'build word ladders',
      ],
      study: [
        ...skillBlock({
          title: 'Look-and-say',
          teach: ['Look at the whole word.', 'Listen to the model.', 'Say it.', 'Cover and write it.'],
          worked: ['Word: elephant → look → say “elephant” → write it.'],
          tryThis: ['Practise: giraffe, cucumber, helicopter'],
        }),
        ...skillBlock({
          title: 'Chunking',
          teach: ['Split a long word into known parts.'],
          worked: ['football = foot + ball', 'classroom = class + room', 'sunshine = sun + shine'],
          tryThis: ['Chunk: handmade, bedroom, toothbrush'],
        }),
        ...skillBlock({
          title: 'Word ladder',
          teach: ['Change one letter at a time.', 'Read every new word.'],
          worked: ['sun → run → ran', 'cat → hat → hot → hop'],
          tryThis: ['Make a ladder of 4 steps starting from “pen”'],
        }),
      ],
      examples: ['elephant (look-and-say)', 'football = foot + ball', 'sun → run → ran'],
      practice: [
        'Read 8 long words pointing under each.',
        'Chunk 5 compound words.',
        'Build one word ladder with 4 steps.',
      ],
      work: ['Copy 10 new words. Read them to a parent.', 'Make flashcards for 5 hard words.'],
      remember: ['Look, say, write.', 'Use chunks for long words.', 'Practise weekly.'],
      inquiry: ['How do you read a word you have not seen before?'],
      quizFacts: ['Look-and-say helps long words', 'Chunking splits words', 'Word ladders change one letter'],
    };
  }

  // General English classroom
  return {
    outcomes: outcomes.length ? outcomes : [`practise ${title}`, `use ${title} in clear sentences`],
    study: [
      `▸ ${title}`,
      '',
      ...bullets(
        'Listen to a model.',
        'Study the example.',
        'Then produce your own example.',
      ),
      '',
      ...skillBlock({
        title: title,
        teach: [
          `Focus skill: ${outcomes[0] || title}.`,
          'Use complete sentences.',
          'Speak clearly; write neatly.',
        ],
        worked: [
          `Model sentence 1 about ${title}.`,
          `Model sentence 2 using a Kenyan school example.`,
          'Model dialogue: A: “…?”  B: “…”',
        ],
        tryThis: [
          'Write 5 original sentences on this skill.',
          'Say one 30-second oral example to a partner.',
        ],
      }),
    ],
    examples: [`One clear model for ${title}`, 'One Kenyan school/home example'],
    practice: ['Write 5 sentences.', 'Do one oral practice with a partner.', 'Correct spelling/punctuation.'],
    work: ['Revision sheet: meaning + 5 examples + 5 practice items.'],
    remember: ['Model first, then try.', 'Use complete sentences.'],
    inquiry: parseInquiryQuestions(topic.rawText || ''),
    quizFacts: outcomes.slice(0, 6).length ? outcomes.slice(0, 6) : [`Practise ${title} daily`],
  };
}

/* -------------------- SCIENCE / ENVIRONMENT / SOCIAL / CRE -------------------- */

function waterPack(title, gradeLabel) {
  const early = /pp|grade-1|grade-2|grade-3/i.test(String(gradeLabel || ''));
  return {
    outcomes: [
      'name uses of water at home and school',
      'explain why clean water is important',
      'show ways to conserve water',
      'practise safe water habits',
    ],
    study: [
      '▸ What is water?',
      '',
      ...bullets(
        early ? 'Water is what we drink and use to wash.' : 'Water is a natural resource we need every day.',
        'We find water in taps, rivers, lakes, tanks, and rain.',
      ),
      '',
      ...skillBlock({
        title: 'Uses of water',
        teach: ['List uses under Home and School.'],
        worked: [
          'Home: drinking, cooking ugali/sukuma, bathing, washing clothes, cleaning utensils.',
          'School: drinking, washing hands, cleaning classrooms, watering gardens.',
          'Farm/community: watering crops, animals drinking.',
        ],
        tryThis: [
          'Draw 4 pictures: drink, wash hands, cook, water a plant. Label each.',
          'Say 3 uses of water at your home.',
        ],
      }),
      ...skillBlock({
        title: 'Why clean water matters',
        teach: [
          'Dirty water can make us sick.',
          'Clean covered water is safer to drink.',
        ],
        worked: [
          'Safe: water from a clean covered container / treated tap water.',
          'Unsafe: open dirty puddle water for drinking.',
        ],
        tryThis: ['Which is safer for drinking: covered tank water or open puddle? Why?'],
        answer: 'Covered tank/treated water — less germs',
      }),
      ...skillBlock({
        title: 'Conserve water (do not waste)',
        teach: [
          'Close the tap when soaping hands.',
          'Report leaking taps.',
          'Use a basin instead of a running tap when washing.',
        ],
        worked: [
          'Bad habit: leaving a tap running while brushing teeth.',
          'Good habit: fill a cup, close tap, brush, rinse.',
        ],
        tryThis: ['List 3 ways you will save water this week at home.'],
      }),
    ],
    examples: [
      'Uses: drinking, cooking, washing, farming',
      'Safe storage: covered clean container',
      'Save water: close taps, fix leaks',
    ],
    practice: [
      'Name 5 uses of water.',
      'Tick safe vs unsafe drinking sources.',
      'Act out: washing hands the correct way (wet → soap → scrub → rinse → close tap).',
    ],
    work: [
      early ? 'With a parent, find 3 places water is used at home. Draw them.' : 'Make a water-saving poster for your class.',
      'Teach a younger child: “Close the tap.”',
    ],
    remember: [
      'Water is useful at home and school.',
      'Drink clean safe water.',
      'Do not waste water.',
    ],
    inquiry: ['What are the uses of water?', 'How do we conserve water?'],
    quizFacts: [
      'Water is used for drinking and washing',
      'Dirty water can cause illness',
      'Close taps to save water',
      'Store drinking water in a clean covered container',
    ],
  };
}

function animalsPack() {
  return {
    outcomes: [
      'identify domestic and wild animals',
      'describe how some animals move or feed',
      'practise kind safe care of animals',
    ],
    study: [
      ...skillBlock({
        title: 'Types of animals',
        teach: [
          'Domestic animals live with people.',
          'Wild animals live on their own.',
        ],
        worked: [
          'Domestic: cow, goat, sheep, chicken, dog, cat.',
          'Wild: lion, zebra, elephant, giraffe, fish in lakes/rivers.',
        ],
        tryThis: ['Sort: dog, lion, chicken, zebra → domestic or wild?'],
        answer: 'dog/chicken domestic; lion/zebra wild',
      }),
      ...skillBlock({
        title: 'Care and safety',
        teach: [
          'Be kind to animals.',
          'Do not touch unknown animals.',
          'Wash hands after handling pets/farm animals.',
        ],
        worked: [
          'Good care: give a dog clean water and food.',
          'Safety: do not put your hand near a strange dog’s mouth.',
        ],
        tryThis: ['Write 2 kind actions and 1 safety rule for animals.'],
      }),
    ],
    examples: ['Cow = domestic', 'Lion = wild', 'Wash hands after touching animals'],
    practice: ['List 5 domestic and 5 wild animals found in Kenya.', 'Draw one animal and label how it moves.'],
    work: ['Visit/observe one animal area safely with an adult. Write 5 facts.'],
    remember: ['Domestic vs wild', 'Be kind', 'Stay safe'],
    inquiry: [],
    quizFacts: ['Cows are domestic animals', 'Lions are wild animals', 'Wash hands after handling animals'],
  };
}

function citizenshipPack(title) {
  return {
    outcomes: [
      `explain ${title} in simple words`,
      'give school examples of good citizenship',
      'practise one responsible action',
    ],
    study: [
      ...skillBlock({
        title: title,
        teach: [
          'A good citizen follows rules, respects others, and cares for shared places.',
          'Rights come with responsibilities.',
        ],
        worked: [
          'School example: lining up quietly for assembly.',
          'School example: putting litter in the bin.',
          'Home example: telling the truth to parents.',
          'Community example: helping an elderly neighbour carry shopping.',
        ],
        tryThis: [
          'List 3 good-citizen actions at school.',
          'List 2 actions that are NOT good citizenship.',
        ],
      }),
    ],
    examples: ['Lining up', 'Telling truth', 'Keeping compound clean'],
    practice: ['Role-play a good citizen vs a bad choice. Discuss why.'],
    work: ['Make a “Good Citizen” poster with 5 bullet points.'],
    remember: ['Respect + responsibility + honesty'],
    inquiry: [],
    quizFacts: [
      'Good citizens follow rules',
      'Putting litter in the bin is good citizenship',
      'Rights come with responsibilities',
    ],
  };
}

function buildSubjectPack(topic, cleanOutcomes) {
  const title = topicTitle(topic);
  const subject = String(topic.subject || '');
  const name = title.toLowerCase();
  const outs = cleanOutcomes.map((s) => s.text);

  if (/math/i.test(subject) || /multipl|divis|add|subtract|fraction|plane|perimet|area|geometry|number|measure|money|time|shape/.test(name)) {
    return buildMathPack(topic);
  }
  if (/english|literacy|language activit/i.test(subject) || /listen|speak|read|writ|euphemism|oral|grammar|comprehension|vocab/.test(name)) {
    return englishPack(topic, outs);
  }
  if (/water/.test(name) || (/environment/i.test(subject) && /water/.test(name))) {
    return waterPack(title, topic.gradeLabel || topic.grade);
  }
  if (/animal/.test(name)) return animalsPack();
  if (/citizen|government|right|responsib/i.test(name) || (/social/i.test(subject) && /citizen|school/.test(name))) {
    return citizenshipPack(title);
  }
  if (/science|environment|hygiene|nutrition|agriculture/i.test(subject)) {
    return {
      outcomes: outs.length
        ? outs
        : [`explain ${title}`, `give Kenyan examples of ${title}`, `practise a safe skill for ${title}`],
      study: [
        ...skillBlock({
          title,
          teach: [
            `Observe ${title} in real life (school compound, home, farm).`,
            'Use safe examples only.',
            'Name → explain → apply.',
          ],
          worked: [
            `Fact 1 about ${title} (in pupil words).`,
            `Fact 2 with a Kenyan example.`,
            `Safe action connected to ${title}.`,
          ],
          tryThis: [
            `Draw/label one diagram for ${title}.`,
            `Write 5 bullet facts about ${title}.`,
            'Say one safety rule.',
          ],
        }),
      ],
      examples: outs.slice(0, 3).map((o) => o),
      practice: [`List 8 facts on ${title}.`, 'Teach a friend using only bullet points.'],
      work: [`Revision sheet for ${title}: meaning, diagram, 5 practice questions.`],
      remember: outs.slice(0, 4).length ? outs.slice(0, 4) : [`Know ${title} with examples`],
      inquiry: parseInquiryQuestions(topic.rawText || ''),
      quizFacts: outs.slice(0, 8).length ? outs.slice(0, 8) : [`${title} needs observation and practice`],
    };
  }

  // Universal classroom shell — still teach → example → try
  const goals = outs.length
    ? outs
    : [
        `explain ${title} in simple words`,
        `give 3 Kenyan examples of ${title}`,
        `practise ${title} step by step`,
      ];
  const study = [];
  goals.slice(0, 5).forEach((goal, i) => {
    study.push(
      ...skillBlock({
        title: `Skill ${i + 1}: ${goal}`,
        teach: [
          `Today’s focus: ${goal}.`,
          'Listen/read the idea.',
          'Watch/study the model.',
          'Then do Try this.',
        ],
        worked: [
          `Model A for “${goal}” using a school example.`,
          `Model B for “${goal}” using a home/county example.`,
        ],
        tryThis: [
          `Your turn: show "${goal}" in 3 bullet points.`,
          'Share with a partner and improve one bullet.',
        ],
      }),
    );
  });

  return {
    outcomes: goals,
    study,
    examples: goals.slice(0, 4).map((g, i) => `Model ${i + 1}: ${g}`),
    practice: goals.slice(0, 4).map((g) => `Practise: ${g}`),
    work: [
      `Make a one-page revision sheet for ${title}.`,
      'Teach someone at home for 2 minutes using bullet points only.',
    ],
    remember: goals.slice(0, 4),
    inquiry: parseInquiryQuestions(topic.rawText || ''),
    quizFacts: goals.slice(0, 8),
  };
}

/* -------------------- BUILDERS -------------------- */

export function buildLessonFromKicd(topic) {
  const raw = cleanText(topic.rawText || '');
  const title = topicTitle(topic);
  const slos = parseSlos(raw).filter((s) => isCleanOutcome(s.text));
  const pack = buildSubjectPack({ ...topic, topicName: title, rawText: raw }, slos);
  const images = topic.imageLines || [];

  const lines = [];
  lines.push(`LESSON: ${title.toUpperCase()}`);
  lines.push('');
  lines.push(`Grade: ${topic.gradeLabel || topic.grade}`);
  lines.push(`Subject: ${topic.subject}`);
  if (topic.strandName) lines.push(`Strand: ${topic.strandName}`);
  lines.push(`Topic ${topic.topicNumber}: ${title}`);
  lines.push('');

  lines.push('SECTION 1: WELCOME');
  lines.push('');
  lines.push(`• Today’s class: ${title}`);
  lines.push('• How we learn: Teach → Worked example → Try this');
  lines.push('• Use point notes. Show working. Then take the quiz.');
  if (pack.inquiry?.[0]) {
    lines.push(`• Big question: ${pack.inquiry[0]}`);
  }
  lines.push('');

  lines.push('SECTION 2: WHAT YOU WILL LEARN');
  lines.push('');
  pack.outcomes.forEach((o, i) => lines.push(`${i + 1}. ${o}`));
  lines.push('');

  if (images.length) {
    lines.push('SECTION 3: PICTURES');
    lines.push('');
    images.forEach((img) => {
      lines.push(img);
      lines.push('');
    });
  }

  lines.push(images.length ? 'SECTION 4: CLASS STUDY (TEACH → EXAMPLE → TRY)' : 'SECTION 3: CLASS STUDY (TEACH → EXAMPLE → TRY)');
  lines.push('');
  (pack.study || []).forEach((line) => lines.push(line));
  lines.push('');

  lines.push('SECTION: QUICK EXAMPLES');
  lines.push('');
  (pack.examples || []).forEach((ex) => lines.push(`• ${ex}`));
  lines.push('');

  lines.push('SECTION: PRACTICE NOW');
  lines.push('');
  (pack.practice || []).forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  lines.push('');

  lines.push('SECTION: WORK TO DO');
  lines.push('');
  (pack.work || []).forEach((w, i) => lines.push(`${i + 1}. ${w}`));
  lines.push('');

  if (pack.inquiry?.length) {
    lines.push('SECTION: THINK ABOUT IT');
    lines.push('');
    pack.inquiry.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push('');
  }

  lines.push('SECTION: REMEMBER');
  lines.push('');
  (pack.remember || []).forEach((r) => lines.push(`• ${r}`));
  lines.push('');
  lines.push('• Next: complete the Revision Quiz. Open Answers only after you finish.');
  lines.push('');
  lines.push('— CBC Learn · Classroom study notes (Strategy 2)');

  return lines.join('\n');
}

export function buildQuizFromKicd(topic) {
  const raw = cleanText(topic.rawText || '');
  const title = topicTitle(topic);
  const slos = parseSlos(raw).filter((s) => isCleanOutcome(s.text));
  const pack = buildSubjectPack({ ...topic, topicName: title, rawText: raw }, slos);
  const facts = (pack.quizFacts || pack.examples || pack.outcomes || []).filter((t) => t && String(t).length > 6);

  const questions = [];
  const answers = [];

  for (let i = 0; i < 10; i += 1) {
    const num = i + 1;
    const fact = facts[i % Math.max(facts.length, 1)] || `Practise ${title} with clear examples`;
    const shortFact = String(fact).length > 110 ? `${String(fact).slice(0, 107)}...` : String(fact);
    questions.push({
      number: num,
      type: 'multiple-choice',
      question: `Which is correct for ${title}?`,
      options: [
        `A. ${shortFact}`,
        `B. Skip examples and only memorise the title`,
        `C. ${title} is never used in real life`,
        `D. Showing working / models is unnecessary`,
      ],
    });
    answers.push({ number: num, answer: 'A', explanation: shortFact });
  }

  const shortItems = [
    { q: pack.inquiry?.[0] || `Explain ${title} using one Kenyan example.`, a: pack.examples?.[0] || 'Use a taught example from Class Study.' },
    { q: `Copy one worked example from this lesson and solve a similar question.`, a: pack.examples?.[1] || pack.examples?.[0] || 'Show clear steps.' },
    { q: pack.practice?.[0] || `Write two practice items on ${title}.`, a: 'Any correct practice matching the taught skills.' },
    { q: `Teach a younger learner one skill from ${title} in bullet points.`, a: pack.remember?.[0] || 'Use Remember points.' },
    { q: `Why study ${title}?`, a: `It builds useful ${topic.subject} skills for school and daily life.` },
  ];
  for (let i = 0; i < 5; i += 1) {
    const num = 11 + i;
    questions.push({ number: num, type: 'short-answer', question: shortItems[i].q });
    answers.push({ number: num, answer: shortItems[i].a, explanation: shortItems[i].a });
  }

  return { questions, answers };
}

/** Match Video Hub scripts to the same classroom structure. */
export function buildVideoScriptFromKicd(topic) {
  const raw = cleanText(topic.rawText || '');
  const title = topicTitle(topic);
  const slos = parseSlos(raw).filter((s) => isCleanOutcome(s.text));
  const pack = buildSubjectPack({ ...topic, topicName: title, rawText: raw }, slos);
  const lines = [];
  lines.push(`VIDEO SCRIPT: ${title.toUpperCase()}`);
  lines.push(`Grade: ${topic.gradeLabel || topic.grade} · Subject: ${topic.subject}`);
  lines.push('');
  lines.push('[0:00–0:20] HOOK');
  lines.push(`• Host: “Today we learn ${title}. Watch the example, then you try.”`);
  lines.push('');
  lines.push('[0:20–2:00] TEACH');
  (pack.remember || []).slice(0, 4).forEach((r) => lines.push(`• ${r}`));
  lines.push('');
  lines.push('[2:00–4:00] WORKED EXAMPLE ON SCREEN');
  (pack.examples || []).slice(0, 4).forEach((ex) => lines.push(`• ${ex}`));
  lines.push('');
  lines.push('[4:00–5:00] TRY THIS (PAUSE)');
  (pack.practice || []).slice(0, 3).forEach((p) => lines.push(`• ${p}`));
  lines.push('');
  lines.push('[5:00–5:30] REMEMBER + CTA');
  lines.push(`• Recap 3 bullets. “Now open Revision Quiz for ${title}.”`);
  lines.push('');
  lines.push('— CBC Learn · Video Hub script aligned to lesson + revision');
  return lines.join('\n');
}

export function formatQuizPages(quizData, topic) {
  const title = topicTitle(topic);
  const qLines = [`REVISION QUIZ: ${title.toUpperCase()}`, '', '• Answer all questions.', '• For calculations, show working on paper.', ''];
  const aLines = [`ANSWERS: ${title.toUpperCase()}`, ''];
  for (const q of quizData.questions) {
    qLines.push(`${q.number}. ${q.question}`);
    if (q.options) q.options.forEach((o) => qLines.push(`   ${o}`));
    qLines.push('');
  }
  for (const a of quizData.answers) {
    aLines.push(`${a.number}. ${a.answer}`);
    if (a.explanation) aLines.push(`   • ${a.explanation}`);
    aLines.push('');
  }
  return { quiz: qLines.join('\n'), answers: aLines.join('\n') };
}

export function stripMarkdown(text) {
  return String(text || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}
