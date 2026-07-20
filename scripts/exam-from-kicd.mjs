/**
 * Build original CBC exam / revision papers from KICD curriculum designs.
 * Questions are newly written from learning outcomes and topics — not copied from commercial books.
 */
import { getTopicSourceText } from './curriculum-source.mjs';

function clean(s) {
  return String(s || '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseOutcomes(rawText) {
  const items = [];
  const re = /\b([a-d])\)\s*([a-z][\s\S]{8,160}?)(?=\s*[a-d]\)|Core Competen|Link to|Suggested|Assessment|$)/gi;
  let m;
  while ((m = re.exec(String(rawText || ''))) !== null) {
    const text = clean(m[2])
      .replace(/\s*Core Competen.*$/i, '')
      .replace(/\s{2,}.*/, '')
      .slice(0, 160);
    if (text.length > 10) items.push(text);
    if (items.length >= 4) break;
  }
  return items;
}

function kenyaStem(subject, topicName) {
  const s = String(subject || '').toLowerCase();
  const t = String(topicName || '').toLowerCase();
  if (/math/.test(s) || /number|add|subtract|count|shape|measure|time|money|fraction/.test(t)) {
    return [
      'at the market in your county',
      'using objects in your classroom',
      'when counting items at home',
      'during a school sports day',
    ];
  }
  if (/english|language|literacy/.test(s)) {
    return [
      'in a conversation with a classmate',
      'when reading a story about Kenya',
      'while writing in your exercise book',
      'when greeting visitors at school',
    ];
  }
  if (/kiswahili/.test(s)) {
    return [
      'darasani na rafiki yako',
      'nyumbani na wazazi',
      'sokoni katika kaunti yako',
      'wakati wa kusoma hadithi',
    ];
  }
  if (/christian|cre|islam|hindu|religious/.test(s)) {
    return [
      'at home with your family',
      'at your place of worship',
      'when helping a neighbour',
      'during a school assembly',
    ];
  }
  if (/science|environment|hygiene|agricult|social/.test(s)) {
    return [
      'in your school compound',
      'around your home',
      'in your county',
      'during a community clean-up',
    ];
  }
  return [
    'at school',
    'at home',
    'in your community',
    'in Kenya today',
  ];
}

function buildQuestionsForTopic(topic, startNum = 1) {
  const raw =
    topic.rawText ||
    getTopicSourceText({
      grade: topic.grade,
      subject: topic.subject,
      topicNumber: topic.topicNumber,
      topicName: topic.topicName,
    })?.rawText ||
    '';
  const outcomes = parseOutcomes(raw);
  const stems = kenyaStem(topic.subject, topic.topicName);
  const name = topic.topicName || topic.strandName || 'this topic';
  const questions = [];
  const answers = [];

  const factBank = outcomes.length
    ? outcomes
    : [
        `Explain the meaning of ${name} using a Kenyan example.`,
        `Practise ${name} at school and at home.`,
        `${name} helps learners in daily life in Kenya.`,
      ];

  // 3 MCQs per topic
  for (let i = 0; i < 3; i += 1) {
    const num = startNum + questions.length;
    const fact = factBank[i % factBank.length];
    const stem = stems[i % stems.length];
    questions.push({
      number: num,
      type: 'mcq',
      question: `About ${name} ${stem}, which statement is correct?`,
      options: [
        `A. ${fact}`,
        `B. Learners should ignore ${name} completely.`,
        `C. ${name} is only useful outside Kenya.`,
        `D. There is no need to practise ${name}.`,
      ],
    });
    answers.push({ number: num, answer: 'A', explanation: fact });
  }

  // 1 short answer
  const num = startNum + questions.length;
  questions.push({
    number: num,
    type: 'short',
    question: `Give two examples of how you can use ${name} ${stems[0]}.`,
  });
  answers.push({
    number: num,
    answer: `Any two relevant local examples showing understanding of ${name}.`,
    explanation: outcomes[0] || `Apply ${name} in daily Kenyan life.`,
  });

  return { questions, answers };
}

function formatPaper({ title, gradeLabel, subject, instructions, questions }) {
  const lines = [];
  lines.push(title.toUpperCase());
  lines.push('');
  lines.push(`Grade: ${gradeLabel}`);
  lines.push(`Subject: ${subject}`);
  lines.push(`Time: ${Math.max(30, questions.length * 2)} minutes`);
  lines.push('');
  lines.push('INSTRUCTIONS');
  lines.push(instructions || '1. Answer all questions.');
  lines.push('2. For multiple choice, write the correct letter only.');
  lines.push('3. For short answers, write clearly in the spaces provided.');
  lines.push('4. Check your work before submitting.');
  lines.push('');
  lines.push('SECTION A: Multiple Choice');
  lines.push('');
  for (const q of questions.filter((x) => x.type === 'mcq')) {
    lines.push(`${q.number}. ${q.question}`);
    for (const opt of q.options || []) lines.push(`   ${opt}`);
    lines.push('');
  }
  lines.push('SECTION B: Short Answers');
  lines.push('');
  for (const q of questions.filter((x) => x.type === 'short')) {
    lines.push(`${q.number}. ${q.question}`);
    lines.push('');
  }
  return lines.join('\n');
}

function formatAnswers({ title, answers }) {
  const lines = [];
  lines.push(`MARKING SCHEME — ${title}`.toUpperCase());
  lines.push('');
  lines.push('Use this after completing the paper.');
  lines.push('');
  for (const a of answers) {
    lines.push(`${a.number}. ${a.answer}`);
    if (a.explanation) lines.push(`   ${a.explanation}`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Build a paper from a list of curriculum topics.
 */
export function buildExamFromTopics({
  grade,
  gradeLabel,
  subject,
  topics,
  category,
  term,
  title,
}) {
  const selected = (topics || []).slice(0, category === 'premium' ? 12 : category === 'mock' ? 10 : 8);
  const allQuestions = [];
  const allAnswers = [];

  for (const topic of selected) {
    const built = buildQuestionsForTopic(
      { ...topic, grade, subject },
      allQuestions.length + 1,
    );
    allQuestions.push(...built.questions);
    allAnswers.push(...built.answers);
  }

  // Ensure minimum size for empty-ish subjects
  while (allQuestions.length < 12) {
    const n = allQuestions.length + 1;
    allQuestions.push({
      number: n,
      type: 'mcq',
      question: `Which habit helps you revise ${subject} successfully?`,
      options: [
        'A. Read notes, practise questions, then check answers',
        'B. Skip revision and guess everything',
        'C. Memorise titles only',
        'D. Avoid asking for help',
      ],
    });
    allAnswers.push({
      number: n,
      answer: 'A',
      explanation: 'Good revision uses notes, practice, and checking.',
    });
  }

  const paperTitle =
    title ||
    (category === 'termly'
      ? `${gradeLabel} ${subject} — Term ${term || 1} Exam`
      : category === 'mock'
        ? `${gradeLabel} ${subject} — Mock Exam`
        : category === 'premium'
          ? `${gradeLabel} ${subject} — Premium Revision Paper`
          : `${gradeLabel} ${subject} — General Assessment`);

  const instructions =
    category === 'mock'
      ? '1. This mock paper follows CBC assessment style.\n2. Answer all questions.\n3. Manage your time carefully.'
      : category === 'premium'
        ? '1. This is an advanced revision paper.\n2. Show working where needed.\n3. Answer all questions.'
        : '1. Answer all questions.\n2. Use neat handwriting.';

  return {
    title: paperTitle,
    pages: {
      quiz: formatPaper({
        title: paperTitle,
        gradeLabel,
        subject,
        instructions,
        questions: allQuestions,
      }),
      answers: formatAnswers({ title: paperTitle, answers: allAnswers }),
      lesson: '',
    },
    metadata: {
      category,
      term: term || null,
      questionCount: allQuestions.length,
      access: category === 'premium' ? 'paid' : category === 'mock' ? 'paid' : 'free',
      priceKes: category === 'premium' ? 150 : category === 'mock' ? 100 : category === 'termly' ? 50 : 0,
      markingScheme: formatAnswers({ title: paperTitle, answers: allAnswers }),
      contentSource: 'original-from-kicd-design',
    },
    questionCount: allQuestions.length,
  };
}

export function paperTypeForCategory(category) {
  switch (category) {
    case 'termly':
      return 'termly-exam';
    case 'mock':
      return 'mock-exam';
    case 'premium':
      return 'premium-exam';
    case 'general':
    default:
      // Subject-level general papers (distinct from per-topic lesson quizzes)
      return 'exam';
  }
}
