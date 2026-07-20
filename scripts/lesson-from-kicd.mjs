/**
 * Build ORIGINAL learner study notes + quizzes from KICD Curriculum Designs.
 *
 * Strategy 2: educational facts from the design; wording/examples are newly written.
 * Never dump raw multi-column curriculum tables into the lesson.
 *
 * Goal: every lesson must contain real study — explanations + worked examples + practice.
 */

import { displayTopicName } from './curriculum-source.mjs';

function cleanText(s) {
  return String(s || '')
    .replace(/\r/g, '')
    .replace(/\f/g, '\n')
    .replace(/Page \d+ of \d+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function flatten(s) {
  return cleanText(s).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function tidyOutcome(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    // Drop letter-echo artifacts like "e) d) create"
    .replace(/\b[a-f]\)\s*[a-f]\)\s*/gi, '')
    .replace(/\s*,\s*$/, '')
    .replace(/\s*Core Competen.*$/i, '')
    .replace(/\s*Link to.*$/i, '')
    .replace(/\s*Suggested.*$/i, '')
    .replace(/\s*\d+\)\s*(?:What|Why|How|Which).*$/i, '')
    // Do NOT strip educational numbers (10, 100, 1000) — only page crumbs at end
    .replace(/\s+Page\s+\d+(\s+of\s+\d+)?$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[.,;]+$/, '');
}

function isCleanOutcome(text) {
  const t = String(text || '').trim();
  if (t.length < 18 || t.length > 220) return false;
  if (/\?/.test(t)) return false;
  if (/you make|from a effective|grade words using|longer word/i.test(t)) return false;
  if (/^(learners?|the learner)\b/i.test(t) && /teacher|group, pairs/i.test(t)) return false;
  if (t.split(/\s+/).length < 5) return false;
  return true;
}

function cleanSlos(slos) {
  return (slos || []).filter((s) => isCleanOutcome(s.text));
}

/**
 * Parse lettered outcomes while preserving numbers like 10 / 100 / 1,000.
 */
function parseSlos(rawText) {
  const flat = flatten(rawText);
  const items = [];
  const re =
    /\b([a-f])\)\s*((?:multiply|divide|add|subtract|count|estimate|create|appreciate|read|write|listen|speak|identify|recognise|recognize|enjoy|use|demonstrate|apply|explain|describe|draw|sing|practise|practice|show|name|state|discuss|perform|compose|observe|compare|sort|match|recite|pray|follow|respond|answer|ask|retell|punctuate|spell|form|join|copy|trace|role[\s-]?play|plant|care|wash|share|obey|respect|tell|say|greet|construct|measure|solve|calculate|model|imitate|dramatise|dramatize|value|classify|group|order|sequence)[\s\S]{10,220}?)(?=\s*[a-f]\)\s*(?:[a-z]|Core|Link|Suggested|Assessment)|Core Competenc|Link to Values|Suggested [Ll]earning|The learner is guided|Assessment Rubric|$)/gi;

  let m;
  while ((m = re.exec(flat)) !== null) {
    let text = tidyOutcome(m[2]);
    if (text.length > 160) {
      const cut = text.search(/\s+(?:The learner is guided|Learners?|What |Why |How |Which )/i);
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
    if (!/assessment|rubric/i.test(q)) found.push(q);
    if (found.length >= 4) break;
  }
  return [...new Set(found)];
}

function topicTitle(topic) {
  return displayTopicName(topic.topicName || topic.subStrand || 'this topic');
}

/* -------------------- MATH STUDY PACKS (worked examples) -------------------- */

function mathMultiplicationPack(title, gradeLabel) {
  return {
    outcomes: [
      'Multiply up to a two-digit number by multiples of 10',
      'Multiply up to a two-digit number by a two-digit number, with and without regrouping',
      'Multiply up to a two-digit number by 100',
      'Estimate products by rounding to the nearest 10 (product not more than 1,000)',
      'Create multiplication patterns with products not more than 100',
      'Use multiplication in real-life Kenyan situations',
    ],
    study: [
      'WHAT MULTIPLICATION MEANS',
      'Multiplication is repeated addition. 4 × 3 means 4 + 4 + 4 = 12.',
      'In Kenya you use multiplication when you buy several items of the same price, when you find the area of a square garden plot, or when you count equal groups in class.',
      '',
      'SKILL 1 — Multiply by multiples of 10 (10, 20, 30…)',
      'Method: multiply the non-zero digits, then add the zeros from the multiple of 10.',
      'Worked example A: 24 × 10',
      '  24 × 1 = 24, then add one zero → 240.',
      '  Check: 24 + 24 + 24 + … (10 times) is long, so place-value is faster.',
      'Worked example B: 36 × 20',
      '  36 × 2 = 72, then add one zero → 720.',
      'Worked example C: 45 × 30',
      '  45 × 3 = 135, then add one zero → 1,350.',
      '',
      'SKILL 2 — Two-digit × two-digit (no regrouping)',
      'Worked example D: 12 × 13',
      '  Break 13 into 10 + 3.',
      '  12 × 10 = 120',
      '  12 × 3 = 36',
      '  Add: 120 + 36 = 156.',
      '',
      'SKILL 3 — Two-digit × two-digit (with regrouping)',
      'Worked example E: 23 × 14',
      '  Break 14 into 10 + 4.',
      '  23 × 10 = 230',
      '  23 × 4 = 92',
      '  Add: 230 + 92 = 322.',
      'Worked example F: 27 × 15',
      '  27 × 10 = 270',
      '  27 × 5 = 135',
      '  Add: 270 + 135 = 405.',
      '',
      'SKILL 4 — Multiply by 100',
      'Method: write the number, then add two zeros.',
      'Worked example G: 18 × 100 = 1,800',
      'Worked example H: 42 × 100 = 4,200',
      '',
      'SKILL 5 — Estimate by rounding to the nearest 10',
      'Round each factor to the nearest 10, then multiply. Keep the estimate ≤ 1,000 for this topic.',
      'Worked example I: Estimate 48 × 19',
      '  48 → 50,  19 → 20',
      '  50 × 20 = 1,000 (estimate)',
      '  Exact: 48 × 20 = 960, then subtract 48 → 912. Estimate was close.',
      'Worked example J: Estimate 34 × 22',
      '  34 → 30,  22 → 20',
      '  30 × 20 = 600',
      '',
      'SKILL 6 — Multiplication patterns (products ≤ 100)',
      'A pattern follows a rule. Example rule: “multiply by 2 each time”.',
      'Worked example K: 2, 4, 8, 16, 32, 64 (×2 each time; all ≤ 100)',
      'Worked example L: 5, 10, 20, 40, 80 (×2 each time)',
      'Worked example M: 3, 6, 12, 24, 48, 96 (×2 each time)',
      '',
      'REAL-LIFE KENYA',
      '• Market: 15 bananas at KSh 8 each → 15 × 8 = 120 shillings.',
      '• Garden: a square plot of side 12 m → area idea uses multiplication (12 × 12).',
      '• Class: 8 rows of 6 desks → 8 × 6 = 48 desks.',
    ],
    examples: [
      'Example 1: 24 × 10 = 240 (multiply by 1, add one zero).',
      'Example 2: 23 × 14 = 230 + 92 = 322 (break into ×10 and ×4).',
      'Example 3: Estimate 48 × 19 ≈ 50 × 20 = 1,000.',
      'Example 4: Pattern ×2: 3, 6, 12, 24, 48, 96.',
    ],
    practice: [
      'Work out: 16 × 10,  25 × 20,  33 × 30.',
      'Work out with regrouping: 23 × 14 and 27 × 15. Show the break-up method.',
      'Work out: 18 × 100 and 42 × 100.',
      'Estimate by rounding to 10: 48 × 19 and 34 × 22.',
      'Continue the pattern: 2, 4, 8, 16, __, __.',
      'Word problem: One exercise book costs KSh 35. What is the cost of 10 books?',
    ],
    work: [
      'In your exercise book, write and solve 10 multiplication questions mixing ×10, ×100, and two-digit × two-digit.',
      'Make a multiplication chart for 12 × 1 up to 12 × 10 using scrap paper or cardboard.',
      'Write one market word problem from your county that needs multiplication. Solve it.',
      'Create a ×2 or ×3 pattern of six numbers with every product ≤ 100.',
    ],
    remember: [
      '×10 → multiply, then add one zero. ×100 → add two zeros.',
      'For two-digit × two-digit, break the second number into tens + ones, then add.',
      'Estimate by rounding to the nearest 10, then multiply.',
      'Patterns follow a clear rule (for example ×2 each time).',
    ],
    inquiry: [
      'When can you use multiplication in real life?',
      'How can you create patterns involving multiplication?',
    ],
    quizFacts: [
      '24 × 10 = 240',
      '36 × 20 = 720',
      '12 × 13 = 156',
      '23 × 14 = 322',
      '18 × 100 = 1,800',
      '48 × 19 is about 50 × 20 = 1,000 when estimating',
      'A ×2 pattern can be 2, 4, 8, 16, 32, 64',
      '15 bananas at KSh 8 each cost 15 × 8 = KSh 120',
    ],
  };
}

function mathGenericPack(title, subject, outcomes) {
  const name = title || 'this topic';
  return {
    outcomes: outcomes.length
      ? outcomes
      : [
          `Explain the main ideas in ${name}`,
          `Solve practice questions on ${name}`,
          `Use ${name} in a real-life Kenyan example`,
        ],
    study: [
      `WHAT YOU ARE LEARNING: ${name.toUpperCase()}`,
      `${name} is a Grade mathematics skill used at school, at the market, and at home.`,
      '',
      'HOW TO STUDY THIS TOPIC',
      '1. Read each idea slowly.',
      '2. Copy every worked example into your book and recalculate it yourself.',
      '3. Then try the practice questions without looking at the answers.',
      '',
      'WORKED EXAMPLE STYLE',
      `Write the question clearly. Show each step. Box the final answer.`,
      'Example framework:',
      `  Question: (write a ${name} problem)`,
      '  Step 1: …',
      '  Step 2: …',
      '  Answer: …',
      '',
      'KENYAN CONTEXT',
      'Use shillings, market goods, school desks, or garden plots as story numbers so the maths feels real.',
    ],
    examples: [
      `Example 1: Solve one simple ${name} question using objects or a drawing.`,
      `Example 2: Solve a harder ${name} question showing every step.`,
      `Example 3: Make a word problem about ${name} set at a Kenyan market.`,
    ],
    practice: [
      `Write and solve five questions on ${name}.`,
      'Explain one solution aloud to a parent or friend.',
      'Invent one new word problem and solve it.',
    ],
    work: [
      `Complete 10 practice questions on ${name} in your exercise book.`,
      'Mark your work. Redo any question you missed.',
      'Teach a younger learner one method from this lesson.',
    ],
    remember: outcomes.slice(0, 4).length
      ? outcomes.slice(0, 4)
      : [
          `Show your working for every ${name} question.`,
          'Check answers by estimating or by a second method.',
          'Link every skill to a real-life example.',
        ],
    inquiry: [],
    quizFacts: outcomes.slice(0, 8),
  };
}

function buildMathPack(topic, cleanOutcomes) {
  const title = topicTitle(topic);
  const blob = `${title} ${topic.topicNumber || ''}`.toLowerCase();
  if (/multipl/.test(blob)) return mathMultiplicationPack(title, topic.gradeLabel);
  if (/divis/.test(blob)) {
    return {
      ...mathGenericPack(title, topic.subject, cleanOutcomes.map((s) => s.text)),
      study: [
        'WHAT DIVISION MEANS',
        'Division shares a total into equal groups. 12 ÷ 3 = 4 means 12 split into 3 equal groups of 4.',
        '',
        'WORKED EXAMPLES',
        'A: 24 ÷ 6 = 4 because 6 × 4 = 24.',
        'B: 36 ÷ 4 = 9 because 4 × 9 = 36.',
        'C: 45 ÷ 5 = 9 because 5 × 9 = 45.',
        '',
        'Check every division by multiplying back.',
        'Real life: 30 exercise books shared equally among 5 learners → 30 ÷ 5 = 6 each.',
      ],
      examples: [
        'Example 1: 24 ÷ 6 = 4 (check: 6 × 4 = 24).',
        'Example 2: 36 ÷ 4 = 9 (check: 4 × 9 = 36).',
        'Example 3: Share 30 books among 5 learners → 6 each.',
      ],
      practice: [
        'Work out: 18 ÷ 3, 28 ÷ 7, 40 ÷ 8. Multiply back to check.',
        'Word problem: 24 oranges shared equally among 6 children. How many each?',
      ],
      quizFacts: ['24 ÷ 6 = 4', '36 ÷ 4 = 9', '45 ÷ 5 = 9', 'Check division by multiplying'],
    };
  }
  if (/add/.test(blob)) {
    return {
      ...mathGenericPack(title, topic.subject, cleanOutcomes.map((s) => s.text)),
      study: [
        'WHAT ADDITION MEANS',
        'Addition joins groups. Align place values: ones under ones, tens under tens.',
        '',
        'WORKED EXAMPLES',
        'A (no regrouping): 23 + 14 = 37',
        'B (with regrouping): 28 + 17 → ones 8+7=15 write 5 carry 1; tens 2+1+1=4 → 45',
        'C: 156 + 238 → work column by column from the right.',
        '',
        'Real life: KSh 45 + KSh 30 fare = KSh 75.',
      ],
      examples: [
        'Example 1: 23 + 14 = 37',
        'Example 2: 28 + 17 = 45 (regroup ones)',
        'Example 3: KSh 45 + KSh 30 = KSh 75',
      ],
      quizFacts: ['23 + 14 = 37', '28 + 17 = 45', 'Add from the ones column first'],
    };
  }
  if (/subtract|minus/.test(blob)) {
    return {
      ...mathGenericPack(title, topic.subject, cleanOutcomes.map((s) => s.text)),
      study: [
        'WHAT SUBTRACTION MEANS',
        'Subtraction finds how many are left or the difference between two numbers.',
        '',
        'WORKED EXAMPLES',
        'A: 48 − 23 = 25',
        'B (regrouping): 52 − 18 → ones need regrouping → 34',
        'C: KSh 100 − KSh 35 = KSh 65 change.',
      ],
      examples: [
        'Example 1: 48 − 23 = 25',
        'Example 2: 52 − 18 = 34',
        'Example 3: KSh 100 − KSh 35 = KSh 65',
      ],
      quizFacts: ['48 − 23 = 25', '52 − 18 = 34', 'Subtract ones first; regroup when needed'],
    };
  }
  if (/fraction/.test(blob)) {
    return {
      ...mathGenericPack(title, topic.subject, cleanOutcomes.map((s) => s.text)),
      study: [
        'WHAT FRACTIONS MEAN',
        'A fraction names equal parts of a whole. In 1/2, the whole is split into 2 equal parts and you take 1.',
        '',
        'WORKED EXAMPLES',
        'A: Shade 1/4 of a rectangle divided into 4 equal parts.',
        'B: 1/2 of 12 mangoes = 6 mangoes.',
        'C: 1/4 of 20 = 5.',
      ],
      examples: [
        'Example 1: 1/2 of 12 = 6',
        'Example 2: 1/4 of 20 = 5',
        'Example 3: 3/4 means 3 equal parts out of 4',
      ],
      quizFacts: ['1/2 of 12 = 6', '1/4 of 20 = 5', 'Denominator = equal parts of the whole'],
    };
  }
  return mathGenericPack(title, topic.subject, cleanOutcomes.map((s) => s.text));
}

/* -------------------- LITERACY / GENERAL PACKS -------------------- */

function literacyPack(topic, cleanOutcomes) {
  const title = topicTitle(topic);
  const name = title.toLowerCase();

  if (/word reading|sight word|vocabulary|word attack/i.test(name)) {
    return {
      outcomes: cleanOutcomes.length
        ? cleanOutcomes.map((s) => s.text)
        : [
            'Read more and longer words, including words that are hard to sound out letter by letter',
            'Read grade-level vocabulary in short texts',
            'Use word-attack skills and enjoy reading new words',
          ],
      study: [
        'WHAT WORD READING MEANS',
        'Word reading is looking at a written word and saying it correctly.',
        'Some longer words do not follow simple letter–sound rules. Your teacher models them. You look, listen, then say.',
        '',
        'METHODS TO STUDY',
        '1. Look-and-say: see the whole word, hear it, say it, cover it, write it.',
        '2. Chunking: split long words — foot+ball, class+room, sun+shine.',
        '3. Root words: in “handmade”, see “hand” and “made”.',
        '4. Word ladder: change one letter at a time (sun → run → ran) and read each step.',
        '',
        'WEEKLY HABIT',
        'Learn about 8–10 new longer words each week. Practise in a group, with a partner, and alone.',
        '',
        'WORKED EXAMPLES',
        'A: elephant — look, listen to the model, say “elephant”, write it.',
        'B: football = foot + ball',
        'C: Word ladder: cat → hat → hot → hop',
      ],
      examples: [
        'Example 1 — Look and say: “elephant” together, then in pairs, then alone.',
        'Example 2 — Chunking: classroom = class + room.',
        'Example 3 — Word ladder: sun → run → ran.',
        'Example 4 — Home: pick two long newspaper words; repeat after a parent; write them.',
      ],
      practice: [
        'Read five long words from a chart while pointing under each word.',
        'Build a four-step word ladder and read it aloud.',
        'Chunk: football, classroom, sunshine, handmade.',
        'Write three new words and use each in a school sentence.',
      ],
      work: [
        'Copy eight new longer words. Read them to a parent tonight.',
        'Make one word ladder of at least four steps.',
        'Answer: How do you read a word you have never seen before?',
      ],
      remember: [
        'Look at the whole word, then say it clearly.',
        'Use chunks, roots, and look-and-say.',
        'Practise about eight to ten new longer words each week.',
      ],
      inquiry: parseInquiryQuestions(topic.rawText || ''),
      quizFacts: [
        'Look-and-say helps with long words',
        'Chunking splits a long word into parts',
        'A word ladder changes one letter at a time',
        'Practise new words every week',
      ],
    };
  }

  if (/multipl|math|number|fraction|add|subtract|divis|measure|geometry|algebra|pattern|shape|money|time/i.test(
    `${name} ${topic.subject || ''}`,
  ) && /math|numeracy|arithmetic/i.test(topic.subject || '')) {
    return buildMathPack(topic, cleanOutcomes);
  }
  // Also route clear maths topic names even if subject label is odd
  if (/^(multiplication|division|addition|subtraction|fractions?|decimals?|percentages?|geometry|algebra|integers?)\b/i.test(name)) {
    return buildMathPack(topic, cleanOutcomes);
  }

  return buildUniversalStudyPack(topic, cleanOutcomes);
}

/**
 * Turn any CBC topic into a pupil study lesson (all subjects / all grades).
 * Not a teacher guide. Not a curriculum dump.
 */
function pupilVoiceOutcome(text) {
  return String(text || '')
    .replace(/^(the\s+)?learner(s)?\s+(should\s+be\s+able\s+to\s+|is\s+able\s+to\s+|can\s+)?/i, '')
    .replace(/^(to\s+)/i, '')
    .trim();
}

function subjectContext(subject, title) {
  const s = String(subject || '').toLowerCase();
  const t = String(title || '').toLowerCase();

  if (/kiswahili/.test(s)) {
    return {
      place: 'nyumbani, shuleni, na sokoni',
      model: [
        `Mfano wa kusoma: Soma sentensi fupi kuhusu “${title}”, kisha eleza kwa maneno yako.`,
        `Mfano wa kuzungumza: Zungumza na rafiki kwa dakika 1 kuhusu ${title}.`,
        `Mfano wa kuandika: Andika sentensi 3 sahihi kuhusu ${title}.`,
      ],
      practiceVerb: 'Soma, sema, kisha andika',
    };
  }
  if (/english|language|literacy/.test(s) || /listen|speak|read|writ|grammar|comprehension|handwrit|spell|punctuat/.test(t)) {
    return {
      place: 'at school, at home, and in your community in Kenya',
      model: [
        `Model reading: Read a short paragraph about “${title}”, then retell it in 3 sentences.`,
        `Model speaking: Say 4 clear sentences about ${title} to a partner.`,
        `Model writing: Write 5 neat sentences using new words from this lesson.`,
      ],
      practiceVerb: 'Listen, speak, read, then write',
    };
  }
  if (/science|environment|hygiene|nutrition|agriculture|home.?science|integrated/.test(s) || /plant|animal|water|soil|weather|food|health|waste|digest|force|energy|matter/.test(t)) {
    return {
      place: 'in your school compound, home, farm, or county',
      model: [
        `Observe: Name what you can see/touch about “${title}” around your school.`,
        `Explain: Say why ${title} matters for health, safety, or the environment in Kenya.`,
        `Apply: Describe one safe action you can take related to ${title} this week.`,
      ],
      practiceVerb: 'Observe, explain, then apply',
    };
  }
  if (/social|history|geography|citizenship|business/.test(s) || /map|county|rights|government|culture|trade|family|community/.test(t)) {
    return {
      place: 'in your county, school, and Kenyan community',
      model: [
        `Locate: Connect “${title}” to a real place or group in Kenya (school, market, county office, home).`,
        `Explain: Give one cause and one effect linked to ${title}.`,
        `Participate: Describe one responsible action a Grade learner can take.`,
      ],
      practiceVerb: 'Locate, explain, then act responsibly',
    };
  }
  if (/christian|cre|islam|hindu|religious|life skills/.test(s) || /prayer|god|allah|bible|quran|value|honest|obedi|respect|peace/.test(t)) {
    return {
      place: 'at home, at your place of worship, and at school',
      model: [
        `Value in action: Show how “${title}” looks when you treat a classmate kindly.`,
        `Story link: Retell a short faith/values story connected to ${title} in your own words.`,
        `Daily habit: Choose one good action to practise today because of this lesson.`,
      ],
      practiceVerb: 'Reflect, retell, then practise a good habit',
    };
  }
  if (/creative|music|art|sport|physical|psychomotor/.test(s) || /song|dance|draw|paint|game|run|jump|rhythm/.test(t)) {
    return {
      place: 'in the classroom, field, or during co-curricular time',
      model: [
        `Warm-up: Do a simple body/voice warm-up linked to “${title}”.`,
        `Demonstrate: Perform or create one short example of ${title}.`,
        `Reflect: Tell a friend one thing you improved after practising.`,
      ],
      practiceVerb: 'Warm up, practise, then perform',
    };
  }
  if (/pre-?technical|computer|ICT|drawing|materials|entrepreneur/.test(s) || /tool|draw|material|safety|design|business/.test(t)) {
    return {
      place: 'in the workshop corner, classroom, or a safe practice space',
      model: [
        `Safety first: State one safety rule before practising “${title}”.`,
        `Steps: List 3 correct steps to complete a simple task on ${title}.`,
        `Check: Inspect your work and say one improvement.`,
      ],
      practiceVerb: 'Plan safely, do the steps, then check',
    };
  }
  return {
    place: 'at school and at home in Kenya',
    model: [
      `Explain “${title}” in your own words using one local example.`,
      `Show one correct way to practise ${title}.`,
      `Teach a younger learner one idea from this lesson.`,
    ],
    practiceVerb: 'Read, practise, then check',
  };
}

function expandOutcomeToStudy(outcome, index, ctx, title) {
  const o = pupilVoiceOutcome(outcome);
  const n = index + 1;
  const model = ctx.model[index % ctx.model.length];
  return [
    `PART ${n}: ${o.charAt(0).toUpperCase()}${o.slice(1)}`,
    '',
    'What this means',
    `In this part you learn to ${o}. You will use ideas from ${ctx.place}.`,
    '',
    'How to learn it',
    `1. Read the idea carefully: ${o}.`,
    `2. ${ctx.practiceVerb} using a Kenyan example from your life.`,
    '3. Check yourself: Can you explain it without looking?',
    '',
    'Model',
    model,
    '',
    'Your turn',
    `Do one short practice that proves you can ${o}. Write or say your answer clearly.`,
    '',
  ];
}

function topicKnowledgeFallback(title, subject) {
  const t = String(title || '').toLowerCase();
  const s = String(subject || '').toLowerCase();

  if (/animal/.test(t)) {
    return {
      outcomes: [
        'identify common animals found at home, school, and in Kenya',
        'group animals in simple ways (for example domestic and wild, or those that live on land and in water)',
        'describe how selected animals move, feed, or protect themselves',
        'practise kind and safe care for animals',
      ],
      studyExtra: [
        'KEY FACTS ABOUT ANIMALS',
        'Animals are living things. They move, feed, grow, and respond to their surroundings.',
        'Domestic animals live with people (cow, goat, chicken, dog, cat).',
        'Wild animals live on their own in forests, parks, or water (lion, zebra, fish).',
        'In Kenya you may see cows in a homestead, fish at a market, or birds on the school field.',
        'Safety: do not touch unknown animals; wash hands after handling pets or farm animals.',
      ],
    };
  }
  if (/plant|seed|leaf|flower|crop/.test(t)) {
    return {
      outcomes: [
        'identify parts of a plant (root, stem, leaf, flower, fruit/seed)',
        'explain what plants need to grow (water, air, light, soil)',
        'describe how people in Kenya use plants for food, shade, or medicine',
        'care for a seedling or garden plot safely',
      ],
      studyExtra: [
        'KEY FACTS ABOUT PLANTS',
        'Roots hold the plant and take in water. Leaves help the plant make food using sunlight.',
        'Kenyan examples: maize, beans, sukuma wiki, bananas, mango trees.',
        'Without water and light, most seedlings wilt.',
      ],
    };
  }
  if (/water/.test(t)) {
    return {
      outcomes: [
        'explain why clean water is important',
        'list ways water is used at home and school',
        'describe simple ways to conserve water in Kenya',
        'practise safe water habits',
      ],
      studyExtra: [
        'KEY FACTS ABOUT WATER',
        'We use water for drinking, cooking, cleaning, and farming.',
        'Conserve water: close taps, fix leaks, reuse grey water for plants where safe.',
        'Unsafe water can cause disease — store drinking water in clean covered containers.',
      ],
    };
  }
  if (/light|heat|force|energy|matter|soil|weather|digest|hygiene|nutrition|food/.test(t)) {
    return {
      outcomes: [
        `explain what ${title} means using everyday Kenyan examples`,
        `describe how ${title} appears at home, school, or in the environment`,
        `practise one safe skill connected to ${title}`,
        `tell why ${title} matters for life in Kenya`,
      ],
      studyExtra: [
        `KEY FACTS: ${title.toUpperCase()}`,
        `${title} is part of Science learning. Connect every idea to something you can observe.`,
        'Use safe examples only. Do not try dangerous experiments without a teacher.',
        'Write definitions in your own words, then add one drawing or real-life example.',
      ],
    };
  }
  if (/citizen|government|right|responsib|map|county|family|community|trade|culture|peace/.test(t) || /social/.test(s)) {
    return {
      outcomes: [
        `explain ${title} in simple words`,
        `give Kenyan school/community examples of ${title}`,
        `describe one responsible action linked to ${title}`,
        `show respect and fairness when practising ${title}`,
      ],
      studyExtra: [
        `KEY FACTS: ${title.toUpperCase()}`,
        'Good citizens follow rules, respect others, and care for shared places.',
        'Kenyan examples: lining up, keeping the compound clean, telling the truth, helping a classmate.',
        'Rights come with responsibilities.',
      ],
    };
  }
  if (/listen|speak|read|writ|grammar|comprehension|vocab|punctuat|spell|handwrit|oral/.test(t) || /english/.test(s)) {
    return {
      outcomes: [
        `practise ${title} clearly and confidently`,
        'use correct words and sentences for the grade level',
        'give examples from school and home conversations',
        'check your work for clarity and neatness',
      ],
      studyExtra: [
        `KEY FACTS: ${title.toUpperCase()}`,
        'Language skills grow by daily practice: listen carefully, speak clearly, read every day, write neatly.',
        'Model → guided practice → independent practice.',
        'Always use complete sentences when writing answers.',
      ],
    };
  }
  if (/multipl|divis|add|subtract|fraction|number|measure|geometry|money|time|pattern|shape/.test(t) || /math/.test(s)) {
    return null; // handled by math packs
  }
  return {
    outcomes: [
      `explain what ${title} means in simple pupil language`,
      `give 3 correct examples of ${title} from Kenya`,
      `practise ${title} in clear steps`,
      `apply ${title} in one real-life situation this week`,
    ],
    studyExtra: [
      `KEY FACTS: ${title.toUpperCase()}`,
      `Study ${title} like a learner textbook page: meaning → examples → practice → check.`,
      'Replace teacher words with your own words.',
      'If a step is unclear, rewrite it shorter and try again.',
    ],
  };
}

function buildUniversalStudyPack(topic, cleanOutcomes) {
  const title = topicTitle(topic);
  const fallback = topicKnowledgeFallback(title, topic.subject);
  const outs = cleanOutcomes.length
    ? cleanOutcomes.map((s) => s.text)
    : fallback?.outcomes || [
        `explain what ${title} means in simple words`,
        `give correct examples of ${title} from school or home`,
        `practise ${title} step by step until you can do it alone`,
        `apply ${title} in a real Kenyan situation`,
      ];

  const ctx = subjectContext(topic.subject, title);
  const study = [
    `WHAT YOU ARE STUDYING: ${title.toUpperCase()}`,
    `Subject: ${topic.subject} · Grade: ${topic.gradeLabel || topic.grade}`,
    `This is a learner study lesson (not a teacher guide). Read every part, follow the models, then practise.`,
    '',
    'BIG PICTURE',
    `${title} helps you succeed in ${topic.subject}. You will understand it, practise it, and use it ${ctx.place}.`,
    '',
  ];

  if (fallback?.studyExtra?.length) {
    study.push(...fallback.studyExtra, '');
  }

  outs.slice(0, 6).forEach((o, i) => {
    study.push(...expandOutcomeToStudy(o, i, ctx, title));
  });

  study.push('PUT IT TOGETHER');
  study.push(`Close your notes and say aloud: what ${title} is, one example, and one way you will practise this week.`);

  const examples = [
    ...(fallback?.studyExtra || []).filter((l) => /Kenyan examples|Domestic|Wild|Roots|Conserve|Good citizens/i.test(l)).slice(0, 2),
    ...outs.slice(0, 4).map((o, i) => {
      const voice = pupilVoiceOutcome(o);
      return `Example ${i + 1}: ${ctx.model[i % ctx.model.length].replace(/^[^:]+:\s*/, '')} (skill: ${voice})`;
    }),
  ];

  const practice = [
    `Write 5 sentences (or show 5 clear steps) that teach ${title} to a classmate.`,
    ...outs.slice(0, 3).map((o) => `Practise this skill: ${pupilVoiceOutcome(o)}.`),
    `Make one local Kenya example of ${title} from your county, market, farm, or school.`,
    'Mark your own work: What did you get right? What will you redo?',
  ];

  const work = [
    `In your exercise book, make a one-page revision sheet for ${title}: meaning, 3 examples, 5 practice items.`,
    'Teach a parent/guardian or younger sibling one part of this lesson (2 minutes).',
    `Answer in writing: Why should a ${topic.gradeLabel || 'CBC'} learner study ${title}?`,
    'Prepare for the quiz: cover the Remember box and recite it.',
  ];

  const remember = [
    `Know what ${title} means in your own words.`,
    'Use local Kenyan examples, not only definitions.',
    'Practise in small steps, then check your work.',
    ...outs.slice(0, 2).map((o) => `Be able to: ${pupilVoiceOutcome(o)}.`),
  ];

  return {
    outcomes: outs.map(pupilVoiceOutcome),
    study,
    examples,
    practice,
    work,
    remember,
    inquiry: parseInquiryQuestions(topic.rawText || ''),
    quizFacts: [
      ...outs.map(pupilVoiceOutcome).slice(0, 6),
      `${title} is practised with local Kenyan examples`,
      'Good study = read notes + follow model + practise + check',
    ],
  };
}

function topicTeachingPack(topic, slos) {
  return literacyPack(topic, cleanSlos(slos));
}

/* -------------------- BUILDERS -------------------- */

export function buildLessonFromKicd(topic) {
  const raw = cleanText(topic.rawText || '');
  const title = topicTitle(topic);
  const slos = parseSlos(raw);
  const pack = topicTeachingPack({ ...topic, topicName: title, rawText: raw }, slos);
  const isKis = /kiswahili/i.test(topic.subject || '');

  const lines = [];
  lines.push(`LESSON: ${title.toUpperCase()}`);
  lines.push('');
  lines.push(`Grade: ${topic.gradeLabel || topic.grade}`);
  lines.push(`Subject: ${topic.subject}`);
  if (topic.strandName) lines.push(`Strand: ${topic.strandName}`);
  lines.push(`Topic ${topic.topicNumber}: ${title}`);
  lines.push('');

  lines.push(isKis ? 'SEHEMU 1: KARIBU' : 'SECTION 1: WELCOME');
  lines.push('');
  lines.push(
    isKis
      ? `Habari! Leo ni somo la kusoma: ${title}. Soma maelezo, fuata mifano iliyofanyiwa kazi, kisha fanya mazoezi.`
      : `Hello! This is a study lesson on ${title}. Read the explanation, follow every worked example, then do the practice. This is original CBC Learn content written from KICD outcomes — not a copy of a commercial textbook.`,
  );
  if (pack.inquiry?.[0]) {
    lines.push('');
    lines.push(isKis ? `Swali kuu: ${pack.inquiry[0]}` : `Big question: ${pack.inquiry[0]}`);
  }
  lines.push('');

  lines.push(isKis ? 'SEHEMU 2: MALENGO' : 'SECTION 2: WHAT YOU WILL LEARN');
  lines.push('');
  lines.push(isKis ? 'Mwisho wa somo hili, utaweza:' : 'By the end of this lesson, you will be able to:');
  lines.push('');
  pack.outcomes.forEach((o, i) => lines.push(`${i + 1}. ${o}`));
  lines.push('');

  lines.push(isKis ? 'SEHEMU 3: SOMO (MAELEZO NA MIFANO)' : 'SECTION 3: STUDY NOTES (READ AND LEARN)');
  lines.push('');
  (pack.study || []).forEach((line) => lines.push(line));
  lines.push('');

  lines.push(isKis ? 'SEHEMU 4: MIFANO YA HARAKA' : 'SECTION 4: QUICK EXAMPLES');
  lines.push('');
  pack.examples.forEach((ex) => {
    lines.push(ex);
    lines.push('');
  });

  lines.push(isKis ? 'SEHEMU 5: MAZOEZI' : 'SECTION 5: PRACTICE NOW');
  lines.push('');
  pack.practice.forEach((task, i) => lines.push(`${i + 1}. ${task}`));
  lines.push('');

  lines.push(isKis ? 'SEHEMU 6: KAZI YA NYUMBANI' : 'SECTION 6: WORK TO DO (HOME / REVISION)');
  lines.push('');
  pack.work.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
  lines.push('');

  if (pack.inquiry?.length) {
    lines.push(isKis ? 'SEHEMU: MASWALI YA KUFIKIRI' : 'SECTION: THINK ABOUT IT');
    lines.push('');
    pack.inquiry.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push('');
  }

  lines.push(isKis ? 'SEHEMU: KUMBUKA' : 'SECTION: REMEMBER');
  lines.push('');
  pack.remember.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  lines.push('');
  lines.push(
    isKis
      ? 'Sasa fanya Jaribio la Marekebisho. Angalia Majibu baada tu ya kumaliza.'
      : 'Now complete the Revision Quiz. Open Answers only after you finish.',
  );
  lines.push('');
  lines.push('— CBC Learn · Original study notes from KICD outcomes (Strategy 2)');

  return lines.join('\n');
}

export function buildQuizFromKicd(topic) {
  const raw = cleanText(topic.rawText || '');
  const title = topicTitle(topic);
  const slos = parseSlos(raw);
  const pack = topicTeachingPack({ ...topic, topicName: title, rawText: raw }, slos);

  const questions = [];
  const answers = [];
  const facts = (pack.quizFacts || pack.outcomes || []).filter((t) => t && t.length > 8);

  for (let i = 0; i < 10; i += 1) {
    const num = i + 1;
    if (i < facts.length) {
      const fact = facts[i];
      const shortFact = fact.length > 110 ? `${fact.slice(0, 107)}...` : fact;
      questions.push({
        number: num,
        type: 'multiple-choice',
        question: `Which statement is correct for ${title}?`,
        options: [
          `A. ${shortFact}`,
          `B. We should skip practising ${title}.`,
          `C. ${title} is never used in real life in Kenya.`,
          `D. Showing working is a waste of time.`,
        ],
      });
      answers.push({ number: num, answer: 'A', explanation: shortFact });
    } else {
      questions.push({
        number: num,
        type: 'multiple-choice',
        question: `What is the best study habit for ${title}?`,
        options: [
          'A. Read the notes, redo worked examples, then practise',
          'B. Guess without reading',
          'C. Memorise only the topic title',
          'D. Avoid checking answers',
        ],
      });
      answers.push({
        number: num,
        answer: 'A',
        explanation: 'Good study means notes + worked examples + practice.',
      });
    }
  }

  const shortItems = [
    {
      q: pack.inquiry?.[0] || `Explain ${title} using one Kenyan example.`,
      a: 'Use a worked idea from Study Notes with a local example.',
    },
    {
      q: `Solve or demonstrate one skill from ${title} and show your working.`,
      a: pack.examples?.[0] || 'Show clear steps and a final answer.',
    },
    {
      q: pack.practice?.[0] || `Write two practice questions on ${title}.`,
      a: 'Any correct practice matching the lesson skills.',
    },
    {
      q: `Teach a younger learner one method from ${title}.`,
      a: pack.remember?.[0] || 'Restate one Remember point simply.',
    },
    {
      q: `Why does a learner need ${title}?`,
      a: `It builds useful ${topic.subject} skills for school and daily life.`,
    },
  ];

  for (let i = 0; i < 5; i += 1) {
    const num = 11 + i;
    questions.push({ number: num, type: 'short-answer', question: shortItems[i].q });
    answers.push({ number: num, answer: shortItems[i].a, explanation: shortItems[i].a });
  }

  return { questions, answers };
}

export function formatQuizPages(quizData, topic) {
  const title = topicTitle(topic);
  const qLines = [`REVISION QUIZ: ${title.toUpperCase()}`, ''];
  const aLines = [`ANSWERS: ${title.toUpperCase()}`, ''];

  for (const q of quizData.questions) {
    qLines.push(`${q.number}. ${q.question}`);
    if (q.options) q.options.forEach((o) => qLines.push(`   ${o}`));
    qLines.push('');
  }
  for (const a of quizData.answers) {
    aLines.push(`${a.number}. ${a.answer}`);
    if (a.explanation) aLines.push(`   ${a.explanation}`);
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
