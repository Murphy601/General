/**
 * Agent 1A (auto) — build a 20-page map from any CBC topic.
 * Used when no handcrafted page-maps entry exists.
 */
import { CONFIG } from './config.mjs';

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
  const re = /\b([a-d])\)\s*([a-z][\s\S]{10,140}?)(?=\s*[a-d]\)|Core Competen|Link to|Suggested|Assessment|$)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const t = m[2].replace(/\s+/g, ' ').trim().replace(/\.$/, '');
    if (t.length > 12) outs.push(t);
    if (outs.length >= 12) break;
  }
  return outs;
}

/**
 * @param {{ topicNumber: string, topicName: string, strandName?: string, subject?: string, grade?: string, rawText?: string }} topic
 */
export function buildAutoPageMap(topic) {
  const name = topic.topicName || 'This Topic';
  const outcomes = extractOutcomeSnippets(topic.rawText);
  const pages = [];
  const n = CONFIG.MIN_PAGES || 20;

  for (let i = 0; i < n; i++) {
    const phase = PHASE_TITLES[i % PHASE_TITLES.length];
    const outcome = outcomes[i % Math.max(outcomes.length, 1)] || null;
    const title =
      i === 0
        ? `What Is ${name}?`
        : i === n - 1
          ? `${name} — Topic Synthesis and Practice`
          : outcome && i < outcomes.length + 2
            ? `${phase}: ${outcome.slice(0, 48)}${outcome.length > 48 ? '…' : ''}`
            : `${phase} — ${name}`;

    const scope = outcome
      ? `Understand and practise: ${outcome}`
      : `${phase.toLowerCase()} for ${name} in ${topic.subject || 'this subject'}`;

    const words = name
      .split(/\s+/)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter((w) => w.replace(/\\/g, '').length > 3)
      .slice(0, 4);
    const kw = new RegExp(words.join('|') || 'learn', 'i');

    pages.push({
      title: title.replace(/\s+/g, ' ').trim().slice(0, 90),
      scope,
      keywords: kw,
      outcome: outcome || null,
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
