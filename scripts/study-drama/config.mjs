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
