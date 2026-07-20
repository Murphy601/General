/**
 * Build learner-facing plain-text lessons and quizzes from KICD Curriculum Designs.
 *
 * Strategy 2: copyright protects exact textbook wording/images — not educational facts.
 * These notes are newly written from official outcomes so the product is original.
 */

function cleanText(s) {
  return String(s || '')
    .replace(/\r/g, '')
    .replace(/Page \d+ of \d+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function splitLetterItems(block) {
  const flat = block.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  const items = [];
  const re = /([a-z])\)\s*/gi;
  const indices = [];
  let m;
  while ((m = re.exec(flat)) !== null) indices.push({ letter: m[1], start: m.index + m[0].length });
  for (let i = 0; i < indices.length; i += 1) {
    const start = indices[i].start;
    const end = i + 1 < indices.length ? flat.lastIndexOf(`${indices[i + 1].letter})`) : flat.length;
    let text = flat.slice(start, end > start ? end : flat.length).trim();
    text = text.replace(/\s*(Core Competenc|Link to|Suggested|Assessment).*$/i, '').trim();
    // Drop right-column bleed (inquiry questions / experience fragments)
    text = text.split(/\s{2,}/)[0] || text;
    text = text.replace(/\s+\d+\.\s+What\b.*$/i, '').replace(/\s+parents and siblings.*$/i, (rest, off, whole) => {
      // keep if it's part of the outcome itself
      return /obeying parents/i.test(whole) ? rest : '';
    });
    if (text.length > 8 && text.length < 220) items.push({ letter: indices[i].letter, text });
  }
  return items.slice(0, 6);
}

function parseSlosFromColumns(rawText) {
  const items = [];
  const lines = String(rawText || '').split('\n');
  let current = null;
  for (const line of lines) {
    const cells = line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
    const left = cells[0] || '';
    const start = left.match(/^([a-d])\)\s*(.*)$/i);
    if (start) {
      if (current && current.text.length > 8) items.push(current);
      current = { letter: start[1].toLowerCase(), text: start[2] };
      continue;
    }
    if (current) {
      if (/^Core Competen|^Link to|^Suggested|^Assessment|^Strand\b/i.test(left)) break;
      if (/^[•]/.test(left) || /^\d+\.\s/.test(left)) continue;
      // continuation of outcome in left/indented column
      if (left && !/learners to|key inquiry/i.test(left)) {
        current.text = `${current.text} ${left}`.replace(/\s+/g, ' ').trim();
      }
    }
  }
  if (current && current.text.length > 8) items.push(current);
  return items.slice(0, 6);
}

function parseSlos(rawText) {
  const columnar = parseSlosFromColumns(rawText);
  if (columnar.length >= 1) return columnar;

  const match = rawText.match(
    /By the end of (?:the (?:of the )?|this )?sub[-\s]*(?:strand|theme)?,?\s*(?:the )?learner should be able to:\s*([\s\S]*?)(?=The learner is guided|Core Competenc|Values:|Pertinent and Contemporary|Links to other|Suggested Community|Page \d+|Assessment Rubric|$)/i,
  );
  if (match) return splitLetterItems(match[1]);

  const kis = rawText.match(
    /Kufikia mwisho wa mada[^\n]*\n?[^a]*aweze:\s*([\s\S]*?)(?=Mapendekezo|Umilisi|Masuala|Page \d+|$)/i,
  );
  if (kis) return splitLetterItems(kis[1]);
  return [];
}

function parseExperiences(rawText) {
  const match = rawText.match(
    /(?:The learner is guided to:|Suggested [Ll]earning [Ee]xperiences)\s*([\s\S]*?)(?=(?:How|Why|What|Which|When|Where)\s|Core Competenc|Values:|Pertinent|Links to other|Page \d+|Assessment Rubric|$)/i,
  );
  const block = match?.[1] || rawText;
  const bullets = block
    .split(/[●•]/)
    .map((p) => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 20 && p.length < 220)
    .filter((p) => /learners?\s|read |role play|sing |list |discuss |draw |practise |practice /i.test(p))
    .filter((p) => !/core competenc|link to|assessment rubric|key inquiry|by the end/i.test(p));
  return [...new Set(bullets)].slice(0, 6);
}

function parseInquiryQuestion(rawText) {
  const match = rawText.match(/(?:How|Why|What|Which|When|Where)[\s\S]{3,120}\?/i);
  return match ? match[0].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

function simpleExplain(sloText, topic) {
  const t = sloText.replace(/\.$/, '');
  return `In this part of the lesson, you learn to ${t.charAt(0).toLowerCase()}${t.slice(1)}. Think about how you can do this at school and at home in Kenya.`;
}

function kenyaExamples(topic) {
  const name = String(topic.topicName || 'this topic').toLowerCase();
  const subject = String(topic.subject || '').toLowerCase();
  const examples = [];

  if (/math|number|count|add|subtract|sort|match|order|pattern|shape|measure|time|money|fraction/i.test(name + subject)) {
    examples.push(
      `Example 1: At the market in your county, count 10 mangoes. Put them in 2 groups of 5. That is sorting and grouping.`,
      `Example 2: In class, count the desks in your row. Write the number in figures and in words.`,
      `Example 3: If you have 7 shillings and your parent gives you 5 more, you have 12 shillings. That is addition.`,
    );
  } else if (/english|language|listen|speak|read|writ|phon|vocab|greeting/i.test(name + subject)) {
    examples.push(
      `Example 1: When you meet your teacher in the morning, say “Good morning” clearly and smile.`,
      `Example 2: Listen to a short story about a child walking to school. Then tell a friend one thing that happened.`,
      `Example 3: Write three sentences about your school using new words from this lesson.`,
    );
  } else if (/kiswahili|kusikiliza|kuzungumza|kusoma|kuandika|msamiati|hadithi/i.test(name + subject)) {
    examples.push(
      `Mfano 1: Asubuhi shuleni, salimu mwalimu: “Shikamoo.” Mwalimu atasema: “Marahaba.”`,
      `Mfano 2: Sikiliza hadithi fupi kisha mweleze rafiki yako jambo moja ulilosikia.`,
      `Mfano 3: Andika sentensi tatu kuhusu familia yako ukitumia maneno mapya.`,
    );
  } else if (/christian|cre|god|jesus|bible|church|prayer|obedien|honest/i.test(name + subject)) {
    examples.push(
      `Example 1: At home, obey your parent when they ask you to wash your plate. That shows obedience.`,
      `Example 2: Tell the truth if you break a cup. Saying what really happened is honesty.`,
      `Example 3: Thank God for your family before you sleep. A short prayer can be: “Thank you God for today.”`,
    );
  } else if (/islam|qur|allah|prophet|eid|mosque/i.test(name + subject)) {
    examples.push(
      `Example 1: Greet others politely using Islamic greetings you have learned.`,
      `Example 2: Keep yourself clean before prayer, just as you wash hands before eating.`,
      `Example 3: Share with a friend one good manner you practised today.`,
    );
  } else if (/hindu|paramatma|prayer|scripture/i.test(name + subject)) {
    examples.push(
      `Example 1: Name one place of worship in your community and say how people show respect there.`,
      `Example 2: Practise sitting quietly for a short prayer or reflection.`,
      `Example 3: Tell your parent one good habit you learned from this lesson.`,
    );
  } else if (/environment|hygiene|nutrition|water|plant|animal|waste|food/i.test(name + subject)) {
    examples.push(
      `Example 1: At school, pick litter and put it in the bin. That cares for the environment.`,
      `Example 2: Wash your hands with soap before eating and after using the toilet.`,
      `Example 3: Name two foods you eat at home that help you grow strong.`,
    );
  } else if (/creative|music|song|dance|art|draw|psychomotor|movement/i.test(name + subject)) {
    examples.push(
      `Example 1: Clap the rhythm of a familiar song, then ask a friend to copy you.`,
      `Example 2: Draw a picture of your favourite game using free shapes and colours.`,
      `Example 3: Practise a simple dance step used during a school celebration.`,
    );
  } else {
    examples.push(
      `Example 1: Talk about ${topic.topicName} using something you see at school.`,
      `Example 2: Give a home example from your county or village.`,
      `Example 3: Teach a younger child one idea from this lesson in simple words.`,
    );
  }
  return examples;
}

function practiceTasks(topic, experiences, slos) {
  const tasks = [];
  const name = topic.topicName;
  tasks.push(`Read the examples above again. Underline two new words or ideas about ${name}.`);
  tasks.push(`Explain ${name} to a parent or classmate using your own words and one Kenyan example.`);
  if (experiences[0]) {
    tasks.push(`Try this activity: ${experiences[0].replace(/^Learners?\s+(are\s+guided\s+to|could|to)\s+/i, 'You should ')}`);
  } else {
    tasks.push(`Draw or write three things that show you understand ${name}.`);
  }
  if (slos[0]) {
    tasks.push(`Show that you can: ${slos[0].text}`);
  }
  tasks.push('Complete the Work to do section, then attempt the Revision Quiz. Check Answers only after you finish.');
  return tasks;
}

function workToDo(topic, inquiry) {
  const items = [
    `Write five sentences about ${topic.topicName}. Use examples from your school, home, or market.`,
    `Answer this question in your exercise book: ${inquiry || `Why is ${topic.topicName} important to you?`}`,
    'Make a short oral presentation (about one minute) to your parent or teacher.',
    'List three ways you will practise this topic this week.',
  ];
  return items;
}

export function buildLessonFromKicd(topic) {
  const raw = cleanText(topic.rawText || '');
  const slos = parseSlos(raw);
  const experiences = parseExperiences(raw);
  const inquiry = parseInquiryQuestion(raw);
  const examples = kenyaExamples(topic);
  const practice = practiceTasks(topic, experiences, slos);
  const revision = workToDo(topic, inquiry);
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
  if (isKis) {
    lines.push(
      `Habari! Leo tutajifunza kuhusu ${topic.topicName}. Soma kwa makini, angalia mifano, kisha fanya mazoezi na jaribio la marekebisho.`,
    );
  } else {
    lines.push(
      `Hello learner! Today we will learn about ${topic.topicName}. Read carefully, study the examples, do the practice, then try the revision quiz.`,
    );
  }
  if (inquiry) {
    lines.push('');
    lines.push(isKis ? `Swali kuu: ${inquiry}` : `Big question: ${inquiry}`);
  }
  lines.push('');

  lines.push(isKis ? 'SEHEMU 2: UTAPATA KUJUA NINI' : 'SECTION 2: WHAT YOU WILL LEARN');
  lines.push('');
  if (slos.length) {
    lines.push(isKis ? 'Mwisho wa somo hili, utaweza:' : 'By the end of this lesson, you will be able to:');
    lines.push('');
    slos.forEach((slo, i) => {
      lines.push(`${i + 1}. ${slo.text}`);
    });
  } else {
    lines.push(
      isKis
        ? `Utajifunza mawazo muhimu kuhusu ${topic.topicName} na kuyatumia nyumbani na shuleni.`
        : `You will learn the key ideas about ${topic.topicName} and use them at home and at school.`,
    );
  }
  lines.push('');

  lines.push(isKis ? 'SEHEMU 3: JIFUNZE HATUA KWA HATUA' : 'SECTION 3: LEARN STEP BY STEP');
  lines.push('');
  if (slos.length) {
    slos.forEach((slo, i) => {
      lines.push(`${i + 1}. ${slo.text}`);
      lines.push(`   ${simpleExplain(slo.text, topic)}`);
      lines.push('');
    });
  } else {
    lines.push(
      `Read about ${topic.topicName} with your parent or teacher. Say what it means in your own words.`,
    );
    lines.push('');
  }

  lines.push(isKis ? 'SEHEMU 4: MIFANO' : 'SECTION 4: EXAMPLES');
  lines.push('');
  examples.forEach((ex) => {
    lines.push(ex);
    lines.push('');
  });

  lines.push(isKis ? 'SEHEMU 5: JARIBU HIVI' : 'SECTION 5: TRY THIS');
  lines.push('');
  practice.forEach((task, i) => {
    lines.push(`${i + 1}. ${task}`);
  });
  lines.push('');

  lines.push(isKis ? 'SEHEMU 6: KAZI YA KUFANYA (MAZOEZI / MAREKEBISHO)' : 'SECTION 6: WORK TO DO (PRACTICE & REVISION)');
  lines.push('');
  revision.forEach((item, i) => {
    lines.push(`${i + 1}. ${item}`);
  });
  lines.push('');

  if (experiences.length) {
    lines.push(isKis ? 'SEHEMU 7: SHUGHULI ZA DARASANI' : 'SECTION 7: CLASS ACTIVITY IDEAS');
    lines.push('');
    experiences.slice(0, 5).forEach((exp, i) => {
      const learnerVoice = exp
        .replace(/^Learners?\s+(are\s+guided\s+to|could|to)\s+/i, '')
        .replace(/^The learner is guided to\s+/i, '');
      lines.push(`${i + 1}. ${learnerVoice.charAt(0).toUpperCase()}${learnerVoice.slice(1)}`);
    });
    lines.push('');
  }

  lines.push(isKis ? 'SEHEMU 8: KUMBUKA' : 'SECTION 8: REMEMBER');
  lines.push('');
  if (slos.length) {
    slos.slice(0, 4).forEach((slo, i) => lines.push(`${i + 1}. ${slo.text}`));
  } else {
    lines.push(`1. ${topic.topicName} is important in everyday life.`);
  }
  lines.push('');
  lines.push(
    isKis
      ? 'Sasa fanya Jaribio la Marekebisho. Angalia Majibu baada tu ya kumaliza.'
      : 'Now complete the Revision Quiz. Open the Answers tab only after you finish.',
  );
  lines.push('');
  lines.push('— CBC Learn · Learner lesson');

  return lines.join('\n');
}

export function buildQuizFromKicd(topic) {
  const raw = cleanText(topic.rawText || '');
  const slos = parseSlos(raw);
  const experiences = parseExperiences(raw);
  const inquiry = parseInquiryQuestion(raw);
  const examples = kenyaExamples(topic);

  const questions = [];
  const answers = [];

  const contentFacts = [
    ...slos.map((s) => s.text),
    ...examples.map((e) => e.replace(/^Example \d+:\s*/i, '').replace(/^Mfano \d+:\s*/i, '')),
  ].filter((t) => t && t.length > 20);

  for (let i = 0; i < 10; i += 1) {
    const num = i + 1;
    if (i < contentFacts.length) {
      const fact = contentFacts[i];
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
      answers.push({
        number: num,
        answer: 'A',
        explanation: shortFact,
      });
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
      q: inquiry || `Explain ${topic.topicName} using one example from your school or home.`,
      a: 'Use ideas from the lesson examples and your own local experience.',
    },
    {
      q: `Write two things you can do to practise ${topic.topicName} this week.`,
      a: experiences.slice(0, 2).join('; ') || 'Practise at school and at home using the Work to do tasks.',
    },
    {
      q: `Name one value or good habit connected to ${topic.topicName}.`,
      a: 'Respect, responsibility, honesty, unity, or another value shown in the lesson.',
    },
    {
      q: `Teach a younger learner one idea from this topic in simple words.`,
      a: 'A correct answer restates a key idea from Section 3 or 4 in child-friendly language.',
    },
    {
      q: `Why should a Grade learner study ${topic.topicName}?`,
      a: `Because it helps you in daily life and builds CBC competencies for ${topic.subject}.`,
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
  const quizLines = [];
  quizLines.push(`REVISION QUIZ: ${String(topic.topicName).toUpperCase()}`);
  quizLines.push('');
  quizLines.push('Instructions: Answer all questions. Do not open the Answers tab until you finish.');
  quizLines.push('');
  quizLines.push('PART A: Multiple choice');
  quizLines.push('');
  for (const q of quizData.questions.filter((x) => x.type === 'multiple-choice')) {
    quizLines.push(`${q.number}. ${q.question}`);
    for (const opt of q.options || []) quizLines.push(`   ${opt}`);
    quizLines.push('');
  }
  quizLines.push('PART B: Short answers');
  quizLines.push('');
  for (const q of quizData.questions.filter((x) => x.type === 'short-answer')) {
    quizLines.push(`${q.number}. ${q.question}`);
    quizLines.push('');
  }

  const answerLines = [];
  answerLines.push(`ANSWERS: ${String(topic.topicName).toUpperCase()}`);
  answerLines.push('');
  answerLines.push('Check your work after finishing the quiz.');
  answerLines.push('');
  for (const a of quizData.answers) {
    answerLines.push(`${a.number}. ${a.answer}`);
    if (a.explanation) answerLines.push(`   ${a.explanation}`);
    answerLines.push('');
  }

  return { quiz: quizLines.join('\n'), answers: answerLines.join('\n') };
}

export function stripMarkdown(text) {
  return String(text || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}
