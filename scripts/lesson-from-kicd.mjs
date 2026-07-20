/**
 * Build comprehensive plain-text lessons and quizzes directly from KICD sub-strand blocks.
 * Uses the FULL curriculum text — not summaries.
 */

function cleanText(s) {
  return String(s || '')
    .replace(/\r/g, '')
    .replace(/Page \d+ of \d+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function parseSlos(rawText) {
  const match = rawText.match(
    /By the end of the sub[-\s]*strand,?\s*the learner should be able to:\s*([\s\S]*?)(?=The learner is guided|Core Competencies|Values:|Pertinent and Contemporary|Links to other|Page \d+|$)/i,
  );
  if (!match) return [];

  const block = match[1].replace(/\n/g, ' ').replace(/\s+/g, ' ');
  const items = [];
  const re = /([a-z])\)\s*/gi;
  const indices = [];
  let m;
  while ((m = re.exec(block)) !== null) indices.push({ letter: m[1], start: m.index + m[0].length });

  for (let i = 0; i < indices.length; i += 1) {
    const start = indices[i].start;
    const end = i + 1 < indices.length ? block.lastIndexOf(`${indices[i + 1].letter})`) : block.length;
    const text = block.slice(start, end > start ? end : block.length).trim();
    if (text) items.push({ letter: indices[i].letter, text });
  }
  return items;
}

function parseExperiences(rawText) {
  const match = rawText.match(
    /The learner is guided to:\s*([\s\S]*?)(?=(?:How|Why|What|Which|When|Where)\s|Core Competencies|Values:|Pertinent and Contemporary|Links to other|Page \d+|$)/i,
  );
  if (!match) return [];

  const block = match[1];
  const bullets = block.split(/[●•]/).map((p) => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()).filter((p) => p.length > 12);
  if (bullets.length) return bullets;

  return block
    .split(/\n/)
    .map((l) => l.replace(/^[●•\-]\s*/, '').trim())
    .filter((l) => l.length > 12);
}

function parseSection(rawText, label) {
  const match = rawText.match(
    new RegExp(`${label}[:\\s]*([\\s\\S]*?)(?=Core Competencies|Values:|Pertinent and Contemporary|Links to other|Page \\d+|$)`, 'i'),
  );
  return match ? cleanText(match[1]) : '';
}

function parseInquiryQuestion(rawText) {
  const match = rawText.match(/(?:How|Why|What|Which|When|Where)[\s\S]{5,160}\?/i);
  return match ? match[0].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

function formatKicdReference(raw) {
  return raw
    .replace(/\n{2,}/g, '\n\n')
    .replace(/([a-z])\)\s*/gi, '\n$1) ')
    .replace(/●/g, '\n  - ')
    .trim();
}

function expandSloExplanation(slo, topic) {
  return [
    `${slo.letter.toUpperCase()}. ${slo.text}`,
    '',
    `   Learning focus: This outcome is part of ${topic.topicName} in the Kenya CBC curriculum.`,
    `   In class: Your teacher will guide you to discuss, practise, and demonstrate this skill using examples from Kenya.`,
    `   At home: Explain this point to a parent using an example from your school, home, or community.`,
    '',
  ];
}

export function buildLessonFromKicd(topic) {
  const raw = cleanText(topic.rawText || '');
  const slos = parseSlos(raw);
  const experiences = parseExperiences(raw);
  const inquiry = parseInquiryQuestion(raw);
  const competencies = parseSection(raw, 'Core Competencies to be developed');
  const values = parseSection(raw, 'Values');
  const pcis = parseSection(raw, 'Pertinent and Contemporary Issues');
  const links = parseSection(raw, 'Links to other Learning Areas');

  const lines = [];
  lines.push(`LESSON: ${topic.topicName.toUpperCase()}`);
  lines.push('');
  lines.push(`Grade: ${topic.gradeLabel || topic.grade}`);
  lines.push(`Subject: ${topic.subject}`);
  lines.push(`Strand: ${topic.strandName}`);
  lines.push(`Topic ${topic.topicNumber}: ${topic.topicName}`);
  lines.push(`Suggested lessons in curriculum: ${topic.lessonCount || 'as per KICD'}`);
  lines.push('');

  lines.push('SECTION 1: INTRODUCTION');
  lines.push('');
  if (inquiry) {
    lines.push(
      `This lesson covers ${topic.topicName}, part of ${topic.strandName} in ${topic.gradeLabel || topic.grade} ${topic.subject}.`,
    );
    lines.push('');
    lines.push(`Key inquiry question: ${inquiry}`);
    lines.push('');
    lines.push(
      'You will study the official KICD learning outcomes, classroom activities, values, and competencies for this topic. Use Kenyan examples from your county, school, and community throughout.',
    );
  } else {
    lines.push(
      `This lesson covers ${topic.topicName} under ${topic.strandName}. It is aligned with the Kenya Institute of Curriculum Development (KICD) CBC design.`,
    );
  }
  lines.push('');

  lines.push('SECTION 2: LEARNING OUTCOMES');
  lines.push('');
  lines.push('By the end of this topic, you should be able to:');
  lines.push('');
  if (slos.length) {
    for (const slo of slos) {
      lines.push(...expandSloExplanation(slo, topic));
    }
  } else {
    lines.push('Refer to the KICD curriculum reference at the end of this lesson for the full list of outcomes.');
    lines.push('');
  }

  lines.push('SECTION 3: KEY CONCEPTS AND EXPLANATION');
  lines.push('');
  const conceptLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  slos.forEach((slo, i) => {
    lines.push(`${conceptLabels[i] || i + 1}. ${slo.text}`);
    lines.push('');
    lines.push(
      `   ${topic.topicName} helps learners achieve this outcome through discussion, practice, and activities at school. Think about how this applies in daily life in Kenya — at home, on the farm, in town, or at school.`,
    );
    lines.push('');
  });

  if (experiences.length) {
    lines.push(`${conceptLabels[slos.length] || 'X'}. Suggested learning experiences (from KICD)`);
    lines.push('');
    experiences.forEach((exp, i) => {
      lines.push(`${i + 1}. ${exp}`);
      lines.push('');
    });
  }

  lines.push('SECTION 4: LEARNING ACTIVITIES');
  lines.push('');
  lines.push('A. At school');
  lines.push('');
  if (experiences.length) {
    experiences.forEach((exp, i) => lines.push(`${i + 1}. ${exp}`));
  } else {
    lines.push('Follow your teacher’s guidance for group work, discussion, and practice on this topic.');
  }
  lines.push('');
  lines.push('B. At home with your parent or guardian');
  lines.push('');
  lines.push(`1. Read this lesson on ${topic.topicName} together.`);
  lines.push('2. Discuss the key inquiry question and give examples from your area.');
  lines.push('3. Write five sentences summarising what you learned.');
  lines.push('4. Prepare for the revision quiz at the end of this topic.');
  lines.push('');

  lines.push('SECTION 5: CORE COMPETENCIES, VALUES, AND PCIs');
  lines.push('');
  if (competencies) {
    lines.push('Core Competencies to be developed:');
    lines.push(competencies);
    lines.push('');
  }
  if (values) {
    lines.push('Values:');
    lines.push(values);
    lines.push('');
  }
  if (pcis) {
    lines.push('Pertinent and Contemporary Issues:');
    lines.push(pcis);
    lines.push('');
  }
  if (links) {
    lines.push('Links to other Learning Areas:');
    lines.push(links);
    lines.push('');
  }

  lines.push('SECTION 6: SUMMARY');
  lines.push('');
  lines.push('Main points to remember:');
  lines.push('');
  if (slos.length) {
    slos.forEach((slo, i) => lines.push(`${i + 1}. ${slo.text}`));
  }
  lines.push('');
  if (inquiry) lines.push(`Remember the key question: ${inquiry}`);
  lines.push('');

  lines.push('SECTION 7: KICD CURRICULUM REFERENCE (FULL TEXT)');
  lines.push('');
  lines.push(formatKicdReference(raw));
  lines.push('');
  lines.push('Grounded in KICD curriculum design for Kenya.');

  return lines.join('\n');
}

export function buildQuizFromKicd(topic) {
  const raw = cleanText(topic.rawText || '');
  const slos = parseSlos(raw);
  const experiences = parseExperiences(raw);
  const inquiry = parseInquiryQuestion(raw);

  const questions = [];
  const answers = [];

  const mcqTemplates = slos.length
    ? slos.map((slo, i) => ({
        q: `What should a learner be able to do according to outcome ${slo.letter.toUpperCase()} in ${topic.topicName}?`,
        correct: slo.text,
        distractors: [
          `Ignore ${topic.topicName} completely`,
          `Work without cooperating with others`,
          `Use examples only from outside Kenya`,
        ],
      }))
    : [];

  while (mcqTemplates.length < 10) {
    const n = mcqTemplates.length + 1;
    mcqTemplates.push({
      q: `Which subject and topic is this quiz about?`,
      correct: `${topic.subject} — ${topic.topicName}`,
      distractors: ['Mathematics — Fractions', 'Science — Plants only', 'English — Grammar only'],
    });
  }

  for (let i = 0; i < 10; i += 1) {
    const t = mcqTemplates[i];
    const num = i + 1;
    const options = [
      `A. ${t.correct}`,
      `B. ${t.distractors[0]}`,
      `C. ${t.distractors[1]}`,
      `D. ${t.distractors[2]}`,
    ];
    questions.push({ number: num, type: 'multiple-choice', question: t.q, options });
    answers.push({ number: num, answer: 'A', explanation: t.correct });
  }

  const shortItems = [
    {
      q: inquiry || `Explain why ${topic.topicName} is important in your county.`,
      a: 'Learner should answer using ideas from the lesson and local Kenyan examples.',
    },
    {
      q: `Name two classroom activities used to teach ${topic.topicName}.`,
      a: experiences.slice(0, 2).join('; ') || 'Activities from the KICD suggested learning experiences.',
    },
    {
      q: `Which strand does ${topic.topicName} belong to?`,
      a: topic.strandName,
    },
    {
      q: `Give two ways parents can support learning of ${topic.topicName} at home.`,
      a: 'Discuss the lesson, use local examples, help with homework and revision.',
    },
    {
      q: `List three learning outcomes for ${topic.topicName}.`,
      a: slos.map((s) => s.text).slice(0, 3).join('; ') || 'Outcomes from the KICD curriculum reference.',
    },
  ];

  for (let i = 0; i < 5; i += 1) {
    const num = 11 + i;
    questions.push({ number: num, type: 'short-answer', question: shortItems[i].q });
    answers.push({
      number: num,
      answer: shortItems[i].a,
      explanation: 'Award marks for accurate, complete answers grounded in the lesson.',
    });
  }

  return { questions, answers };
}

export function stripMarkdown(text) {
  return String(text || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1');
}

export function formatQuizPages(quizData, topic) {
  let quiz = 'REVISION QUIZ\n\n';
  quiz += `Grade: ${topic.gradeLabel || topic.grade}\n`;
  quiz += `Subject: ${topic.subject}\n`;
  quiz += `Topic: ${topic.topicNumber} ${topic.topicName}\n\n`;
  quiz += 'INSTRUCTIONS: Answer all questions. Write your answers clearly. For multiple choice, write the correct letter only.\n\n';

  for (const q of quizData.questions || []) {
    quiz += `Question ${q.number}. ${q.question}\n`;
    if (q.options) {
      for (const opt of q.options) quiz += `   ${opt}\n`;
    }
    quiz += '\n';
  }

  let answers = 'ANSWER KEY\n\n';
  answers += `Topic: ${topic.topicNumber} ${topic.topicName}\n`;
  answers += `Subject: ${topic.subject}\n\n`;
  for (const a of quizData.answers || []) {
    answers += `Question ${a.number}. ${a.answer}\n`;
    if (a.explanation) answers += `   Explanation: ${a.explanation}\n`;
    answers += '\n';
  }

  return { quiz, answers };
}
