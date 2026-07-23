/**
 * Study-Content & Drama Engine — shared CONFIG
 */
export const CONFIG = {
  CURRICULUM: 'CBC / KICD (Kenya)',
  SUBJECT: 'INTEGRATED SCIENCE',
  GRADE: 'Grade 8 JSS',
  MIN_PAGES: 20,
  VIDEO_LENGTH: '5–10 minutes',
  CONTENT_SOURCE: 'study-drama-engine-v1',
  /** DESIGN_ONLY | NOTES_GIVEN | BOTH */
  SOURCE_MODE: 'BOTH',
  DESIGN_INPUT: '',
  NOTES_INPUT: '',
  EXAM_BODY: 'KJSEA',
  PAPERS_PER_SUBJECT: 20,
  PAPER_TIERS: ['GENERAL', 'TERMLY', 'MOCK', 'PREMIUM'],
};

export const BANNED_INTRO_FRAMES = [
  /Around .+?, learners meet science ideas without opening a textbook/i,
  /so you can recognise it, name it correctly, and use it safely/i,
  /This page explains .+ so you can recognise/i,
  /learners meet science ideas without opening/i,
  // Universal mass-writer skeletons (must never ship)
  /is not just a heading/i,
  /In plain words:/i,
  /One useful fact to keep:/i,
  /A learner studying .+ meets .+ first by naming the idea/i,
  /This page teaches .+ so you can define it, apply it/i,
  /you can practise .+ with things you can see and touch/i,
  /shows up in small daily actions — this page names them clearly/i,
  /You will learn the meaning, one worked example linked to/i,
  /At (a |an )?(classroom|home|market|shamba|duka|playground).+, what is /i,
];

export function matchesBannedIntro(text) {
  return BANNED_INTRO_FRAMES.some((re) => re.test(String(text || '')));
}

/** Normalize design outcome jargon → student goals */
export function outcomeToGoal(outcome) {
  return String(outcome || '')
    .replace(/^the learner should be able to\s*/i, '')
    .replace(/^learners? (should|will) (be able to\s*)?/i, '')
    .replace(/\.$/, '')
    .trim()
    .replace(/^(.)/, (c) => c.toUpperCase());
}
