/**
 * Agent 4 — QA & Verification (student-facing pages + drama)
 */
import {
  hasForbiddenMarkup,
  bannedPlaceholder,
  hasScaffoldingLeak,
  isMetaAnswer,
} from './house-style.mjs';

const REQUIRED_SECTIONS = [
  'WHAT YOU WILL LEARN',
  'INTRODUCTION',
  'MAIN NOTES',
  'WORKED EXAMPLE',
  'IN EVERYDAY LIFE',
  'SUMMARY',
  'REVISION QUESTIONS',
  'ANSWERS',
];

export function runQA({ topic, pageMap, studyPages, drama, ledger, minPages }) {
  const bodies = studyPages.map((p) => p.body).join('\n\n');
  const checks = [];

  // 1 Display
  const displayFail = studyPages.some((p) => hasForbiddenMarkup(p.body)) || hasForbiddenMarkup(drama);
  checks.push({
    id: 1,
    name: 'Display',
    pass: !displayFail,
    evidence: displayFail
      ? 'Forbidden markdown/ASCII markers found in pages or drama'
      : 'No # ** |---| backticks detected; house style dividers present',
  });

  // 2 Completeness — student shape with numbered questions + answers (no Q1/A1 IDs)
  let complete = true;
  let completeEvidence = [];
  for (const p of studyPages) {
    for (const sec of REQUIRED_SECTIONS) {
      if (!new RegExp(sec, 'i').test(p.body)) {
        complete = false;
        completeEvidence.push(`Page ${p.pageNumber} missing ${sec}`);
      }
    }
    const hasQ = /^1\./m.test(p.body) && /^2\./m.test(p.body) && /^3\./m.test(p.body);
    const answersBlock = p.body.split(/ANSWERS\n----/i)[1] || '';
    const hasA = /^1\./m.test(answersBlock) && /^2\./m.test(answersBlock) && /^3\./m.test(answersBlock);
    if (!hasQ || !hasA) {
      complete = false;
      completeEvidence.push(`Page ${p.pageNumber} missing numbered questions/answers`);
    }
    if (bannedPlaceholder(p.body)) {
      complete = false;
      completeEvidence.push(`Page ${p.pageNumber} has banned meta language`);
    }
  }
  checks.push({
    id: 2,
    name: 'Completeness',
    pass: complete,
    evidence: complete
      ? 'Every page has student sections + 3 numbered questions with full answers'
      : completeEvidence.slice(0, 8).join('; '),
  });

  // 3 Fact accuracy
  const badPairs =
    /Nitrogen[^\n]{0,40}Helium|Nitrogen[^\n]{0,30}\bHe\b|liquids have a definite shape(?! of their own)(?![^\n]{0,40}no definite)/i.test(
      bodies,
    );
  const openVerify = /\[VERIFY\]/.test(bodies);
  checks.push({
    id: 3,
    name: 'Science/Fact Accuracy',
    pass: !badPairs && !openVerify,
    evidence: badPairs
      ? 'Suspicious false pairing or known misconception string found'
      : openVerify
        ? 'Open [VERIFY] markers remain'
        : 'No known false symbol pairings; no open [VERIFY]',
  });

  // 4 Curriculum alignment — student-friendly goals instead of formal CBC jargon on page
  const aligned = studyPages.every(
    (p) => /WHAT YOU WILL LEARN/i.test(p.body) && /MAIN NOTES/i.test(p.body) && /REVISION QUESTIONS/i.test(p.body),
  );
  checks.push({
    id: 4,
    name: 'Curriculum Alignment',
    pass: aligned,
    evidence: aligned
      ? 'Student learning goals + main notes + revision present on all pages'
      : 'Missing student learning structure on one or more pages',
  });

  // 5 No loops — unique worked examples
  const worked = studyPages.map((p) => {
    const m = p.body.match(/WORKED EXAMPLE\n----\n([\s\S]*?)(\n\n[A-Z]|\n[A-Z][A-Z ]+\n----)/);
    return (m ? m[1] : p.body).slice(0, 120);
  });
  const uniqueWorked = new Set(worked).size;
  const qStemCount = (ledger.questionStems || []).length;
  const uniqueStems = new Set((ledger.questionStems || []).map((s) => s.slice(0, 48))).size;
  const noLoops = uniqueWorked === studyPages.length && uniqueStems >= Math.floor(qStemCount * 0.85);
  checks.push({
    id: 5,
    name: 'No Loops',
    pass: noLoops,
    evidence: `unique worked examples ${uniqueWorked}/${studyPages.length}; unique questions ${uniqueStems}/${qStemCount}`,
  });

  // 6 Page count — COMPLETE markers are orchestrator-only now
  const pageCountOk = studyPages.length >= minPages && studyPages.length === pageMap.pages.length;
  checks.push({
    id: 6,
    name: 'Page Count',
    pass: pageCountOk,
    evidence: `${studyPages.length} pages (min ${minPages}); map entries ${pageMap.pages.length}`,
  });

  // 7 Drama integrity
  const dramaOk =
    /SCENE 1/i.test(drama) &&
    /AGE RATING/i.test(drama) &&
    !/narrator explains|Dr\.?\s*Amani|\bJabali\b|\bMakena\b/i.test(drama) &&
    /LOGLINE/i.test(drama) &&
    /CLOSING REFLECTION CARD/i.test(drama);
  checks.push({
    id: 7,
    name: 'Drama Integrity',
    pass: dramaOk,
    evidence: dramaOk
      ? 'Acted scenes, age rating, story-specific cast, no banned recurring cast / note-narration'
      : 'Drama missing required structure or contains banned narration/recurring cast',
  });

  // 8 Runtime
  const sceneCount = (drama.match(/SCENE \d+/gi) || []).length;
  const words = drama.split(/\s+/).filter(Boolean).length;
  const runtimeOk = sceneCount >= 6 && sceneCount <= 12 && words >= 700 && words <= 2200;
  checks.push({
    id: 8,
    name: 'Runtime',
    pass: runtimeOk,
    evidence: `scenes=${sceneCount}, dialogue/action words≈${words} (target 5–10 min band)`,
  });

  // 9 No scaffolding leak
  const leakPages = studyPages.filter((p) => hasScaffoldingLeak(p.body)).map((p) => p.pageNumber);
  checks.push({
    id: 9,
    name: 'No Scaffolding Leak',
    pass: leakPages.length === 0,
    evidence:
      leakPages.length === 0
        ? 'No Q/A IDs, ledgers, CONTINUE tokens, Bloom/marks, or page counters on student pages'
        : `Scaffolding found on pages: ${leakPages.slice(0, 10).join(', ')}`,
  });

  // 10 Real teaching — answers must not be meta; definitions must not only restate title
  let realTeaching = true;
  let realEvidence = [];
  for (const p of studyPages) {
    const ans = p.body.split(/ANSWERS\n----/i)[1] || '';
    if (isMetaAnswer(ans) || isMetaAnswer(p.body)) {
      realTeaching = false;
      realEvidence.push(`Page ${p.pageNumber} meta-answer language`);
    }
    // Title-restatement smell: "X means X" style
    const title = p.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`${title}\\s+means\\s+${title}`, 'i').test(p.body)) {
      realTeaching = false;
      realEvidence.push(`Page ${p.pageNumber} definition restates title`);
    }
    if (/A1 content:|should use accurate terms/i.test(p.body)) {
      realTeaching = false;
      realEvidence.push(`Page ${p.pageNumber} template answer leak`);
    }
  }
  checks.push({
    id: 10,
    name: 'Real Teaching',
    pass: realTeaching,
    evidence: realTeaching
      ? 'Answers teach real content; no title-restatement definitions'
      : realEvidence.slice(0, 6).join('; '),
  });

  const allPass = checks.every((c) => c.pass);
  const lines = [
    'QA REPORT',
    '====',
    `Topic: ${topic.topicNumber} ${topic.topicName}`,
    '',
    ...checks.map((c) => `Check ${c.id} ${c.name}: ${c.pass ? 'PASS' : 'FAIL'} — ${c.evidence}`),
    '',
    `VERDICT: ${allPass ? 'APPROVED' : 'REJECTED'}`,
  ];
  if (!allPass) {
    lines.push('');
    lines.push('FIXES:');
    checks
      .filter((c) => !c.pass)
      .forEach((c, i) => {
        lines.push(`${i + 1}. Agent responsible for Check ${c.id} (${c.name}): ${c.evidence}`);
      });
  }

  return { approved: allPass, report: lines.join('\n'), checks };
}
