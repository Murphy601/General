/**
 * Agent 1A (auto) — build a 20-page map from any CBC topic.
 * Used when no handcrafted page-maps entry exists.
 */
import { CONFIG, outcomeToGoal, matchesBannedIntro } from './config.mjs';

const PHASE_TITLES = [
  'Meet the Idea',
  'Key Words You Must Know',
  'How It Works Step by Step',
  'Look Closely — Examples',
  'Try It With Local Materials',
  'Common Mistakes to Avoid',
  'Compare and Contrast',
  'Safety and Respect',
  'Practice With Numbers or Facts',
  'Tell It in Your Own Words',
  'Home and School Link',
  'Community and Kenya Link',
  'Worked Problem Walkthrough',
  'Check Your Understanding',
  'Harder Challenge',
  'Values and Responsibility',
  'Exam-Style Thinking',
  'Revision Sprint',
  'Fix the Wrong Answer',
  'Topic Synthesis and Practice',
];

function hash(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0;
  return h;
}

/** Pull short teaching bullets from KICD raw text */
export function paragraphsFromRaw(rawText) {
  const text = String(rawText || '')
    .replace(/\r/g, '\n')
    .replace(/\n{2,}/g, '\n');
  const chunks = text
    .split(/(?<=[.!?])\s+|\n+|•|–|- /)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 28 && s.length <= 280)
    .filter((s) => !/^(By the end|The learner|Core competen|Suggested|Assessment|Link to)/i.test(s))
    .map((s) =>
      s
        .replace(/^the learner should be able to\s*/i, '')
        .replace(/^learners? (should|will) (be able to\s*)?/i, '')
        .replace(/^(.)/, (c) => c.toUpperCase()),
    );
  const seen = new Set();
  const out = [];
  for (const c of chunks) {
    const k = c.slice(0, 40).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c.endsWith('.') ? c : `${c}.`);
    if (out.length >= 80) break;
  }
  return out;
}

export function extractOutcomeSnippets(rawText) {
  const text = String(rawText || '');
  const outs = [];
  const re = /\b([a-f])\)\s*([a-z][\s\S]{10,160}?)(?=\s*[a-f]\)|Core Competen|Link to|Suggested|Assessment|$)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const t = m[2].replace(/\s+/g, ' ').trim().replace(/\.$/, '');
    if (t.length > 12 && !/page\s+\d+\s+of/i.test(t)) outs.push(t);
    if (outs.length >= 12) break;
  }
  return outs;
}

/** Clean bullet subtopics from design tables (e.g. Heat capacity, Latent heat) */
export function extractSubtopicBullets(rawText) {
  const text = String(rawText || '');
  const found = [];
  const seen = new Set();
  const re = /(?:^|\n)\s*[•\-]\s*([A-Za-z][^\n]{3,60})/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    let t = m[1].replace(/\s+/g, ' ').trim().replace(/[.;,]+$/, '');
    if (/^(By the end|The learner|Core|Suggested|Assessment|Page \d|Link to|derive|explain|determine|obtain|discuss|carry out|deliberate|use print)/i.test(t)) {
      continue;
    }
    if (/digital literacy|self-efficacy|core competen|learner develops|resilience|inflicting|manipulative|non-print|print or non-print/i.test(t)) {
      continue;
    }
    if (/\b(of|the|to|and|for|with|using|from|a|an)$/i.test(t)) continue;
    // Expand common truncated heat/physics labels
    if (/^specific heat$/i.test(t)) t = 'Specific heat capacity';
    if (/^specific latent$/i.test(t)) t = 'Specific latent heat';
    if (/^factors affecting$/i.test(t)) t = 'Factors affecting boiling and melting';
    if (/^applications of$/i.test(t)) t = 'Applications of specific heat capacity';
    if (t.split(/\s+/).length > 8) t = t.split(/\s+/).slice(0, 6).join(' ');
    const key = t.toLowerCase();
    if (seen.has(key) || t.length < 4) continue;
    seen.add(key);
    found.push(t);
    if (found.length >= 12) break;
  }
  return found;
}

function cleanConceptTitle(raw, fallback) {
  let t = String(raw || fallback || 'Concept')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.…]+$/g, '');
  // Prefer noun-phrase titles, not "determine the…"
  t = t.replace(/^(determine|obtain|explain|derive and use|describe|identify|state|discuss|carry out)\s+(with peers\s+)?(the\s+)?/i, '');
  t = t.replace(/\b(activities to( analyse)?|use print and non-print)\b.*$/i, '').trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  // Reject truncated prepositional endings
  if (/\b(of|the|to|and|for|with|using|from|a|an)$/i.test(t) || t.split(/\s+/).length < 2) {
    t = fallback || 'Core idea';
  }
  if (t.length > 70) t = `${t.slice(0, 67).replace(/\s+\S*$/, '')}…`;
  return t || fallback || 'Concept';
}

/**
 * @param {{ topicNumber: string, topicName: string, strandName?: string, subject?: string, grade?: string, rawText?: string }} topic
 */
export function buildAutoPageMap(topic) {
  const name = topic.topicName || 'This Topic';
  const outcomes = extractOutcomeSnippets(topic.rawText);
  const bullets = extractSubtopicBullets(topic.rawText);
  const concepts =
    bullets.length >= 2
      ? bullets
      : outcomes.map((o) => cleanConceptTitle(o, name)).filter(Boolean);
  const pages = [];
  const n = CONFIG.MIN_PAGES || 20;

  // Concept-focused early pages, then phase practice pages
  const conceptPages = Math.min(concepts.length, 8);

  for (let i = 0; i < n; i++) {
    const phase = PHASE_TITLES[i % PHASE_TITLES.length];
    const concept = concepts[i % Math.max(concepts.length, 1)] || name;
    const outcome = outcomes[i % Math.max(outcomes.length, 1)] || null;

    let title;
    if (i === 0) title = `Understanding ${name}`;
    else if (i === n - 1) title = `${name} — Topic Synthesis and Practice`;
    else if (i <= conceptPages) title = cleanConceptTitle(concept, name);
    else title = `${phase} — ${cleanConceptTitle(concept, name)}`;

    const scope = outcome
      ? outcomeToGoal(outcome)
      : `Explain ${cleanConceptTitle(concept, name)} within ${name} using correct terms and a clear example or calculation.`;

    const words = `${name} ${concept}`
      .split(/\s+/)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter((w) => w.replace(/\\/g, '').length > 3)
      .slice(0, 6);
    const kw = new RegExp(words.join('|') || 'learn', 'i');

    pages.push({
      title: title.replace(/\s+/g, ' ').trim().slice(0, 90),
      scope,
      outcome: outcome ? outcomeToGoal(outcome) : null,
      topicName: name,
      focus: cleanConceptTitle(concept, name),
      keywords: kw,
    });
  }

  // Deduplicate titles
  const seen = new Set();
  pages.forEach((p, idx) => {
    let t = p.title;
    if (seen.has(t)) t = `${t} (${idx + 1})`;
    seen.add(t);
    p.title = t;
  });

  return {
    topicName: name,
    strand: topic.strandName || `Strand ${topic.strandNumber || ''}`.trim(),
    subStrand: `${topic.topicNumber || ''} ${name}`.trim(),
    pages,
    auto: true,
    seed: hash(`${topic.grade}|${topic.subject}|${topic.topicNumber}|${name}`),
  };
}
