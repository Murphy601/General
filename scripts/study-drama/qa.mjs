/**
 * Agent 4 — QA & Verification
 */
import { hasForbiddenMarkup, bannedPlaceholder } from './house-style.mjs';

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

  // 2 Completeness
  let complete = true;
  let completeEvidence = [];
  for (const p of studyPages) {
    for (let n = 1; n <= 3; n++) {
      if (!new RegExp(`Q${n}\\b`).test(p.body) || !new RegExp(`A${n}\\b`).test(p.body)) {
        complete = false;
        completeEvidence.push(`Page ${p.pageNumber} missing Q${n}/A${n}`);
      }
    }
    if (bannedPlaceholder(p.body)) {
      complete = false;
      completeEvidence.push(`Page ${p.pageNumber} has banned placeholder/meta language`);
    }
  }
  checks.push({
    id: 2,
    name: 'Completeness',
    pass: complete,
    evidence: complete ? 'Every page has Q1–Q3 and A1–A3; no banned placeholders' : completeEvidence.join('; '),
  });

  // 3 Fact accuracy (spot heuristics)
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

  // 4 Curriculum alignment
  const aligned = studyPages.every(
    (p) =>
      /Specific Learning Outcome/i.test(p.body) &&
      /Key Inquiry Question/i.test(p.body) &&
      /Bloom:/i.test(p.body) &&
      /\d+\s*marks/i.test(p.body),
  );
  checks.push({
    id: 4,
    name: 'Curriculum Alignment',
    pass: aligned,
    evidence: aligned
      ? 'CBC framing + Bloom levels + marks present on all pages'
      : 'Missing Learning Outcome / Key Inquiry / Bloom-marks on one or more pages',
  });

  // 5 No loops
  const practicalStarts = studyPages.map((p) => {
    const m = p.body.match(/SECTION 2 — WORKED EXAMPLES[\s\S]{0,220}/);
    return (m || [''])[0];
  });
  const uniquePractical = new Set(practicalStarts).size;
  const qStemCount = (ledger.questionStems || []).length;
  const uniqueStems = new Set((ledger.questionStems || []).map((s) => s.slice(0, 48))).size;
  const noLoops = uniquePractical === studyPages.length && uniqueStems >= Math.floor(qStemCount * 0.9);
  checks.push({
    id: 5,
    name: 'No Loops',
    pass: noLoops,
    evidence: `unique worked openings ${uniquePractical}/${studyPages.length}; unique question stems ${uniqueStems}/${qStemCount}`,
  });

  // 6 Page count
  const pageCountOk =
    studyPages.length >= minPages &&
    studyPages.length === pageMap.pages.length &&
    studyPages.every((p) => /PAGE \d+ OF \d+ COMPLETE/.test(p.body));
  checks.push({
    id: 6,
    name: 'Page Count',
    pass: pageCountOk,
    evidence: `${studyPages.length} pages (min ${minPages}); map entries ${pageMap.pages.length}; COMPLETE markers checked`,
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

  const allPass = checks.every((c) => c.pass);
  const lines = [
    'QA REPORT',
    '====',
    `Topic: ${topic.topicNumber} ${topic.topicName}`,
    '',
    ...checks.map(
      (c) => `Check ${c.id} ${c.name}: ${c.pass ? 'PASS' : 'FAIL'} — ${c.evidence}`,
    ),
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
