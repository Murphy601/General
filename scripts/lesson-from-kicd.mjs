/**
 * Build learner-facing plain-text lessons and quizzes from KICD Curriculum Designs.
 *
 * Strategy 2: copyright protects exact textbook wording/images — not educational facts.
 * These notes are newly written from official outcomes so the product is original.
 *
 * Never dump raw multi-column curriculum tables into the lesson.
 */

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
    .replace(/\s*,\s*$/, '')
    .replace(/\s*Core Competen.*$/i, '')
    .replace(/\s*Link to.*$/i, '')
    .replace(/\s*Suggested.*$/i, '')
    .replace(/\s*\d+\)\s*(?:What|Why|How|Which).*$/i, '')
    .replace(/\b\d{2,3}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[.,;]+$/, '');
}

/** Reject outcomes polluted by multi-column PDF bleed (inquiry Qs, page crumbs). */
function isCleanOutcome(text) {
  const t = String(text || '').trim();
  if (t.length < 18 || t.length > 180) return false;
  if (/\?/.test(t)) return false;
  if (/you make|from a effective|grade words using|longer word|page \d+/i.test(t)) return false;
  if (/^(learners?|the learner)\b/i.test(t) && /teacher|group, pairs/i.test(t)) return false;
  // Too fragmented / missing verbs
  const words = t.split(/\s+/);
  if (words.length < 5) return false;
  return true;
}

function cleanSlos(slos) {
  return (slos || []).filter((s) => isCleanOutcome(s.text));
}

/**
 * Multi-column KICD PDFs interleave outcome text with experiences / inquiry.
 * Pull lettered outcomes aggressively from the flattened stream.
 */
function parseSlos(rawText) {
  const flat = flatten(rawText);
  const items = [];
  const re =
    /\b([a-d])\)\s*((?:read|write|listen|speak|identify|recognise|recognize|enjoy|use|demonstrate|apply|explain|describe|count|add|subtract|multiply|divide|draw|sing|practise|practice|show|name|state|discuss|perform|create|compose|observe|compare|sort|match|recite|pray|appreciate|follow|respond|answer|ask|retell|punctuate|spell|form|join|copy|trace|role[\s-]?play|sing|dance|plant|care|wash|share|obey|respect|tell|say|greet|construct|measure|estimate|classify|group|order|sequence|solve|calculate|model|imitate|dramatise|dramatize|appreciate|value|appreciate)[\s\S]{8,200}?)(?=\s*[a-d]\)\s*(?:[a-z]|Core|Link|Suggested|Assessment)|Core Competenc|Link to Values|Suggested [Ll]earning|Suggested assessment|Assessment Rubric|$)/gi;

  let m;
  while ((m = re.exec(flat)) !== null) {
    let text = tidyOutcome(m[2]);
    // Prefer stopping at first clause boundary if still polluted
    if (text.length > 140) {
      const cut = text.search(/\s+(?:Learners?|The learner|What |Why |How |Which )/i);
      if (cut > 40) text = text.slice(0, cut).trim();
    }
    if (text.length > 12 && text.length < 200) {
      items.push({ letter: m[1].toLowerCase(), text });
    }
    if (items.length >= 6) break;
  }

  if (items.length) return items;

  // Column-aware fallback: lines with a) at left/middle cells
  const lines = cleanText(rawText).split('\n');
  let current = null;
  for (const line of lines) {
    const cells = line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
    for (const cell of cells) {
      const start = cell.match(/^([a-d])\)\s*(.+)$/i);
      if (start) {
        if (current && current.text.length > 8) items.push(current);
        current = { letter: start[1].toLowerCase(), text: tidyOutcome(start[2]) };
      } else if (current && /^[a-z]/.test(cell) && !/^[•]/.test(cell) && !/^(Core|Link|Suggested|Strand|Learners? )/i.test(cell)) {
        current.text = tidyOutcome(`${current.text} ${cell}`);
      }
    }
  }
  if (current && current.text.length > 8) items.push(current);
  return items.filter((x) => x.text.length > 12).slice(0, 6);
}

function parseExperiences(rawText) {
  const flat = flatten(rawText);
  const bullets = flat
    .split(/[●•]/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 25 && p.length < 200)
    .filter((p) => /learners?\s|read |role play|sing |list |discuss |draw |practise |practice |play |listen /i.test(p))
    .filter((p) => !/core competenc|link to|assessment rubric|by the end|suggested formative/i.test(p))
    .map((p) => p.replace(/\s+\d+\)\s*(?:What|Why|How).*$/i, '').trim());
  return [...new Set(bullets)].slice(0, 6);
}

function parseInquiryQuestions(rawText) {
  const flat = flatten(rawText);
  const found = [];
  const re = /\b((?:How|Why|What|Which|When|Where)[^?]{3,100}\?)/gi;
  let m;
  while ((m = re.exec(flat)) !== null) {
    const q = m[1].replace(/\s+/g, ' ').trim();
    if (!/assessment|rubric/i.test(q)) found.push(q);
    if (found.length >= 4) break;
  }
  return [...new Set(found)];
}

function simpleExplain(sloText) {
  const t = sloText.replace(/\.$/, '');
  return `In simple words: practise until you can ${t.charAt(0).toLowerCase()}${t.slice(1)}. Use examples from school and home in Kenya.`;
}

/**
 * Topic-aware teaching packs — used when PDF columns are messy, and to enrich examples.
 * Facts come from KICD outcomes; wording is original.
 */
function topicTeachingPack(topic, slos) {
  const name = String(topic.topicName || '').toLowerCase();
  const subject = String(topic.subject || '').toLowerCase();
  const grade = topic.gradeLabel || topic.grade || '';
  const clean = cleanSlos(slos);

  // --- Word reading / vocabulary ---
  if (/word reading|sight word|vocabulary|word attack/i.test(name)) {
    return {
      outcomes: clean.length
        ? clean.map((s) => s.text)
        : [
            'Read more and longer words, including words that are not easy to sound out letter by letter',
            'Read grade-level vocabulary in short classroom texts',
            'Enjoy reading new words and use word-attack skills when stuck',
          ],
      steps: [
        'Word reading means looking carefully at a word and saying it correctly.',
        'Some longer words do not follow simple letter–sound rules. Your teacher models them. You look, listen, then say the word.',
        'Learn about 8 to 10 new longer words each week. Start with words your teacher shows the class.',
        'Use word-attack skills when a word is new: look-and-say, find a smaller chunk, find a root word, or cover part of the word and reveal it bit by bit.',
        'Practise in a group, with a partner, and alone so you become confident.',
      ],
      examples: [
        'Example 1 — Look and say: Teacher shows the word “elephant”. Class reads “elephant” together, then in pairs, then one by one.',
        'Example 2 — Word ladder: Write “sun”. Change one letter to make “run”, then “ran”. Say each word as you build the ladder.',
        'Example 3 — Chunking: In “football”, see “foot” + “ball”. In “classroom”, see “class” + “room”.',
        'Example 4 — At home: Open a newspaper or storybook. Pick two long words. Ask a parent to say them, then you repeat and write them.',
      ],
      practice: [
        'Read five new long words from the board or a chart. Point under each word as you say it.',
        'Play a word ladder with a friend: change one letter at a time and read every new word aloud.',
        'Find the root or chunks in these words: football, classroom, sunshine, handmade.',
        'Choose three new words. Write each word, draw a small picture, and use it in a sentence about school.',
      ],
      work: [
        'Copy eight new longer words into your exercise book. Read them to a parent tonight.',
        'Make a word ladder of at least four steps. Read it aloud.',
        'Answer: How do you read a word you have never seen before?',
        'From a newspaper, circle five words you can already read and two that are new. Practise the new ones.',
      ],
      remember: [
        'Look at the whole word, then say it clearly.',
        'Use chunks, roots, and look-and-say when letter sounds are not enough.',
        'Practise new words every week — about eight to ten longer words.',
        'Enjoy reading: the more you practise, the easier long words become.',
      ],
      inquiry: [
        'What are some of the new words that you know?',
        'Why do you enjoy reading some words?',
        'How do you read words you have not seen before?',
        'How many words can you make from a longer word?',
      ],
    };
  }

  // --- Connected text / fluency / comprehension ---
  if (/fluency|connected text|comprehension|reading aloud|silent reading/i.test(name)) {
    return {
      outcomes: clean.length
        ? clean.map((s) => s.text)
        : [
            `Read connected text about ${topic.topicName} with understanding`,
            'Answer questions about what you read',
            'Read more smoothly with practice',
          ],
      steps: [
        'Connected text means sentences and short passages — not only single words.',
        'First look at any new words. Then read the whole sentence.',
        'If you do not understand, read again more slowly and ask: Who? What? Where?',
        'Fluency grows when you re-read the same short passage until it sounds smooth.',
      ],
      examples: [
        `Example 1: Read a short paragraph about a child walking to school in Kenya. Then tell a friend one thing that happened.`,
        'Example 2: Time yourself reading a short passage. Read it again and try to sound clearer, not only faster.',
        'Example 3: After reading, answer: Who was in the story? What happened first?',
      ],
      practice: [
        'Read a short passage aloud to a partner. Ask them to tell you one clear sentence they heard.',
        'Re-read the same passage silently, then aloud once more.',
        'Write two questions about the passage and swap with a friend.',
      ],
      work: [
        'Read one short story or paragraph at home and retell it in four sentences.',
        'List three new words from your reading and use each in a sentence.',
        'Explain to a parent what the passage was mainly about.',
      ],
      remember: [
        'Read words in sentences, not only alone.',
        'Re-reading builds fluency and confidence.',
        'Always check that you understand who, what, and where.',
      ],
      inquiry: parseInquiryQuestions(topic.rawText || ''),
    };
  }

  // --- Listening / speaking ---
  if (/listen|speaking|greeting|conversation|attentive|oral/i.test(name) || (/english|language/i.test(subject) && /listen|speak/i.test(name))) {
    return {
      outcomes: clean.length ? clean.map((s) => s.text) : [`Practise ${topic.topicName} clearly and politely`],
      steps: [
        `${topic.topicName} helps you communicate well at school and at home.`,
        'Listen with your eyes and ears. Face the speaker and wait for your turn.',
        'When you speak, use a clear voice and polite words.',
        'Practise short dialogues with a partner using Kenyan school situations.',
      ],
      examples: [
        'Example 1: When you meet your teacher in the morning, say “Good morning” clearly and smile.',
        'Example 2: Listen to a short instruction, then repeat it to a friend in your own words.',
        'Example 3: Role-play buying an item at the market using polite requests: “Please…”, “Thank you.”',
      ],
      practice: [
        'Practise a 30-second greeting dialogue with a partner.',
        'Listen to three instructions and carry them out in order.',
        'Tell a short news item from your day using complete sentences.',
      ],
      work: [
        'Teach a younger learner one polite greeting from this lesson.',
        'Write five sentences you can say when welcoming a visitor at school.',
        'Ask a parent to give you three oral instructions; write them down after listening.',
      ],
      remember: [
        'Good listeners look, wait, and respond.',
        'Clear speech helps others understand you.',
        'Polite language shows respect.',
      ],
      inquiry: parseInquiryQuestions(topic.rawText || ''),
    };
  }

  // --- Writing / spelling / handwriting / punctuation ---
  if (/writ|spell|handwrit|punctuat|compos/i.test(name)) {
    return {
      outcomes: clean.length ? clean.map((s) => s.text) : [`Improve your ${topic.topicName} through guided practice`],
      steps: [
        `${topic.topicName} makes your writing clear so others can read it easily.`,
        'Look at the model your teacher shows. Notice shape, order, and spacing.',
        'Practise slowly first, then build neat speed.',
        'Check your work: Did you spell carefully? Did you use correct marks?',
      ],
      examples: [
        'Example 1: Copy three model sentences neatly, leaving finger spaces between words.',
        'Example 2: Spell five lesson words aloud, then write them without looking.',
        'Example 3: Fix this sentence by adding capital letters and a full stop: “amina went to kisumu”',
      ],
      practice: [
        'Write five neat sentences about your school using words from this topic.',
        'Exchange books with a friend and check spelling or punctuation together.',
        'Rewrite one messy sentence so it is clear and correct.',
      ],
      work: [
        'Complete a short guided paragraph in your exercise book.',
        'List eight words from this topic and practise spelling them with a parent.',
        'Write a short note to a friend using correct punctuation.',
      ],
      remember: [
        'Neat writing helps the reader.',
        'Check spelling and punctuation before you finish.',
        'Practice a little every day.',
      ],
      inquiry: parseInquiryQuestions(topic.rawText || ''),
    };
  }

  // --- Mathematics ---
  if (/math|number|count|add|subtract|sort|match|order|pattern|shape|measure|time|money|fraction|geometry|algebra/i.test(name + ' ' + subject)) {
    return {
      outcomes: clean.length ? clean.map((s) => s.text) : [`Use ${topic.topicName} to solve everyday problems`],
      steps: [
        `Today’s maths focus is ${topic.topicName}.`,
        'Start with objects you can touch or draw — stones, sticks, bottle tops, or drawings in your book.',
        'Say the steps aloud as you work so you do not skip a stage.',
        'Check your answer with a second method or by estimating.',
      ],
      examples: [
        'Example 1: At the market, count 10 mangoes and put them in 2 groups of 5.',
        'Example 2: In class, count the desks in your row and write the number in figures and in words.',
        'Example 3: If you have 7 shillings and receive 5 more, you have 12 shillings.',
      ],
      practice: [
        `Solve three short problems about ${topic.topicName} using drawings.`,
        'Explain one solution to a partner in your own words.',
        'Make up one new word problem set in your county or school.',
      ],
      work: [
        'Write five practice questions and solve them in your book.',
        'Show your working clearly — not only the final answer.',
        'Teach a younger learner one idea from this lesson with bottle tops or drawings.',
      ],
      remember: [
        'Use objects or drawings when a sum feels hard.',
        'Check every answer.',
        `${topic.topicName} is used in real Kenyan life — market, school, and home.`,
      ],
      inquiry: parseInquiryQuestions(topic.rawText || ''),
    };
  }

  // --- Generic pack from SLOs ---
  const outcomeTexts = clean.length
    ? clean.map((s) => s.text)
    : [
        `Explain the main ideas in ${topic.topicName}`,
        `Practise ${topic.topicName} at school and at home`,
        `Give Kenyan examples connected to ${topic.topicName}`,
      ];

  return {
    outcomes: outcomeTexts,
    steps: outcomeTexts.map((o, i) => `${i + 1}. ${o}\n   ${simpleExplain(o)}`),
    examples: kenyaExamplesFallback(topic),
    practice: [
      `Underline two new ideas about ${topic.topicName} in the examples.`,
      `Explain ${topic.topicName} to a parent using one local example.`,
      `Draw or write three things that show you understand ${topic.topicName}.`,
      clean[0] ? `Show that you can: ${clean[0].text}` : `Practise one skill from this lesson with a friend.`,
    ].filter(Boolean),
    work: [
      `Write five sentences about ${topic.topicName} using examples from school or home.`,
      `Answer: Why is ${topic.topicName} important for a ${grade} learner?`,
      'Make a one-minute oral presentation to a parent or teacher.',
      'List three ways you will practise this topic this week.',
    ],
    remember: outcomeTexts.slice(0, 4),
    inquiry: parseInquiryQuestions(topic.rawText || ''),
  };
}

function kenyaExamplesFallback(topic) {
  const name = String(topic.topicName || 'this topic');
  return [
    `Example 1: Talk about ${name} using something you see at school in Kenya.`,
    `Example 2: Give a home example from your county, estate, or village.`,
    `Example 3: Teach a younger child one idea from this lesson in simple words.`,
  ];
}

function toLearnerActivity(exp) {
  return exp
    .replace(/^Learners?\s+(are\s+guided\s+to|could|to)\s+/i, '')
    .replace(/^The learner is guided to\s+/i, '')
    .replace(/^Learner\s+/i, '')
    .trim();
}

export function buildLessonFromKicd(topic) {
  const raw = cleanText(topic.rawText || '');
  const slos = parseSlos(raw);
  const experiences = parseExperiences(raw);
  const pack = topicTeachingPack({ ...topic, rawText: raw }, slos);
  const isKis = /kiswahili/i.test(topic.subject || '');

  const lines = [];
  lines.push(`LESSON: ${String(topic.topicName).toUpperCase()}`);
  lines.push('');
  lines.push(`Grade: ${topic.gradeLabel || topic.grade}`);
  lines.push(`Subject: ${topic.subject}`);
  if (topic.strandName) lines.push(`Strand: ${topic.strandName}`);
  lines.push(`Topic ${topic.topicNumber}: ${topic.topicName}`);
  lines.push('');

  lines.push(isKis ? 'SEHEMU 1: KARIBU' : 'SECTION 1: WELCOME');
  lines.push('');
  lines.push(
    isKis
      ? `Habari! Leo tutajifunza kuhusu ${topic.topicName}. Soma, angalia mifano, fanya mazoezi, kisha jaribu jaribio la marekebisho.`
      : `Hello! Today we learn about ${topic.topicName}. Read the explanation, study the examples, do the practice, then try the revision quiz.`,
  );
  if (pack.inquiry?.[0]) {
    lines.push('');
    lines.push(isKis ? `Swali kuu: ${pack.inquiry[0]}` : `Big question: ${pack.inquiry[0]}`);
  }
  lines.push('');

  lines.push(isKis ? 'SEHEMU 2: UTAPATA KUJUA NINI' : 'SECTION 2: WHAT YOU WILL LEARN');
  lines.push('');
  lines.push(isKis ? 'Mwisho wa somo hili, utaweza:' : 'By the end of this lesson, you will be able to:');
  lines.push('');
  pack.outcomes.forEach((o, i) => lines.push(`${i + 1}. ${o}`));
  lines.push('');

  lines.push(isKis ? 'SEHEMU 3: JIFUNZE HATUA KWA HATUA' : 'SECTION 3: LEARN STEP BY STEP');
  lines.push('');
  pack.steps.forEach((step) => {
    // steps may already include numbered explain lines
    if (/^\d+\.\s/.test(step) && step.includes('\n')) {
      lines.push(step);
      lines.push('');
    } else {
      lines.push(`• ${step}`);
      lines.push('');
    }
  });

  lines.push(isKis ? 'SEHEMU 4: MIFANO' : 'SECTION 4: EXAMPLES');
  lines.push('');
  pack.examples.forEach((ex) => {
    lines.push(ex);
    lines.push('');
  });

  lines.push(isKis ? 'SEHEMU 5: JARIBU HIVI' : 'SECTION 5: TRY THIS');
  lines.push('');
  pack.practice.forEach((task, i) => lines.push(`${i + 1}. ${task}`));
  lines.push('');

  lines.push(isKis ? 'SEHEMU 6: KAZI YA KUFANYA' : 'SECTION 6: WORK TO DO (PRACTICE & REVISION)');
  lines.push('');
  pack.work.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
  lines.push('');

  if (experiences.length) {
    lines.push(isKis ? 'SEHEMU 7: SHUGHULI ZA DARASANI' : 'SECTION 7: CLASS ACTIVITY IDEAS');
    lines.push('');
    experiences.slice(0, 5).forEach((exp, i) => {
      const voice = toLearnerActivity(exp);
      lines.push(`${i + 1}. ${voice.charAt(0).toUpperCase()}${voice.slice(1)}`);
    });
    lines.push('');
  }

  if (pack.inquiry?.length > 1) {
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
      : 'Now complete the Revision Quiz. Open the Answers tab only after you finish.',
  );
  lines.push('');
  lines.push('— CBC Learn · Original learner lesson from KICD outcomes (Strategy 2)');

  return lines.join('\n');
}

export function buildQuizFromKicd(topic) {
  const raw = cleanText(topic.rawText || '');
  const slos = parseSlos(raw);
  const pack = topicTeachingPack({ ...topic, rawText: raw }, slos);

  const questions = [];
  const answers = [];

  const facts = [
    ...pack.outcomes,
    ...pack.remember,
    ...pack.examples.map((e) => e.replace(/^Example[^:]+:\s*/i, '').replace(/^Mfano[^:]+:\s*/i, '')),
  ].filter((t) => t && t.length > 20);

  for (let i = 0; i < 10; i += 1) {
    const num = i + 1;
    if (i < facts.length) {
      const fact = facts[i];
      const shortFact = fact.length > 110 ? `${fact.slice(0, 107)}...` : fact;
      questions.push({
        number: num,
        type: 'multiple-choice',
        question: `Which statement is true about ${topic.topicName}?`,
        options: [
          `A. ${shortFact}`,
          `B. We should ignore ${topic.topicName} at home and school.`,
          `C. ${topic.topicName} is only for teachers, not learners.`,
          `D. There is no need to practise ${topic.topicName}.`,
        ],
      });
      answers.push({ number: num, answer: 'A', explanation: shortFact });
    } else {
      questions.push({
        number: num,
        type: 'multiple-choice',
        question: `What is the best way to learn ${topic.topicName}?`,
        options: [
          'A. Read examples, practise, then revise with a quiz',
          'B. Skip the lesson and guess the answers',
          'C. Memorise only the topic title',
          'D. Avoid asking questions',
        ],
      });
      answers.push({
        number: num,
        answer: 'A',
        explanation: 'Good learners study examples, practise, and revise.',
      });
    }
  }

  const shortItems = [
    {
      q: pack.inquiry?.[0] || `Explain ${topic.topicName} using one example from your school or home.`,
      a: 'Use ideas from the lesson examples and your own local experience.',
    },
    {
      q: `Write two things you can do to practise ${topic.topicName} this week.`,
      a: pack.practice.slice(0, 2).join(' ') || 'Practise at school and at home using the Work to do tasks.',
    },
    {
      q: pack.inquiry?.[1] || `Name one good habit connected to ${topic.topicName}.`,
      a: 'A correct answer uses an idea from Remember or Examples.',
    },
    {
      q: `Teach a younger learner one idea from this topic in simple words.`,
      a: pack.remember[0] || 'Restate a key idea from Learn step by step.',
    },
    {
      q: `Why should a learner study ${topic.topicName}?`,
      a: `It builds useful skills for ${topic.subject} in daily Kenyan life.`,
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
  const qLines = [`REVISION QUIZ: ${String(topic.topicName).toUpperCase()}`, ''];
  const aLines = [`ANSWERS: ${String(topic.topicName).toUpperCase()}`, ''];

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
