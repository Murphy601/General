// Shared parser for Grade 4 authored lessons (markdown-ish) and question banks (JSON).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const SUBJECTS = {
  'agriculture': 'AGRICULTURE',
  'arabic-language': 'ARABIC LANGUAGE',
  'christian-religious-education': 'CHRISTIAN RELIGIOUS EDUCATION',
  'creative-arts': 'CREATIVE ARTS',
  'english-language': 'ENGLISH LANGUAGE',
  'french': 'FRENCH',
  'german': 'GERMAN',
  'hindu-religious-education': 'HINDU RELIGIOUS EDUCATION',
  'indigenous-languages': 'INDIGENOUS LANGUAGES',
  'islamic-religious-education': 'ISLAMIC RELIGIOUS EDUCATION',
  'kiswahili': 'KISWAHILI',
  'mandarin': 'MANDARIN',
  'mathematics': 'MATHEMATICS',
  'science-and-technology': 'SCIENCE AND TECHNOLOGY',
  'social-studies': 'SOCIAL STUDIES',
};

export const PAGE_KINDS = ['hook', 'concept', 'example', 'practice', 'activity', 'story', 'real-life', 'mistakes', 'vocabulary', 'fact', 'project', 'review', 'summary'];

export function parseLesson(text, file = '') {
  const errors = [];
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) return { errors: [`${file}: missing front matter`] };
  const meta = {};
  for (const line of fm[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  const body = text.slice(fm[0].length);
  const parts = body.split(/^## /m).slice(1);
  const pages = [];
  let quiz = [];
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const head = part.slice(0, nl).trim();
    const content = part.slice(nl + 1).trim();
    const pm = head.match(/^PAGE\s+(\d+)\s*:\s*(.+)$/i);
    if (pm) {
      let title = pm[2].trim(), kind = '';
      const km = title.match(/^(.*\S)\s+\|\s*([a-z-]+)$/);
      if (km) { title = km[1]; kind = km[2]; }
      pages.push({ pageNumber: Number(pm[1]), title, kind, raw: content, figures: [] });
    }
    else if (/^QUIZ$/i.test(head)) quiz = parseQuiz(content, errors, file);
    else errors.push(`${file}: unknown section "## ${head}"`);
  }
  for (const p of pages) {
    p.text = p.raw.replace(/^:::figure\n([\s\S]*?)\n:::\s*$/gm, (_, block) => {
      const cap = (block.match(/^caption:\s*(.+)$/m) || [])[1] || '';
      const alt = (block.match(/^alt:\s*(.+)$/m) || [])[1] || '';
      const svg = (block.match(/<svg[\s\S]*<\/svg>/) || [])[0] || '';
      p.figures.push({ caption: cap, alt, svg });
      return `[DIAGRAM]\nTYPE: svg\nPURPOSE: ${cap}\nALT: ${alt}\nPAYLOAD:\n${svg}\nCAPTION: ${cap}\n[/DIAGRAM]`;
    });
  }
  return { meta, pages, quiz, errors };
}

function parseQuiz(content, errors, file) {
  const items = [];
  const blocks = content.split(/^(?=\d+\.\s)/m).filter((b) => b.trim());
  for (const b of blocks) {
    const lines = b.split('\n');
    const first = lines[0].match(/^(\d+)\.\s+(.*)$/);
    if (!first) { errors.push(`${file}: bad quiz block "${lines[0].slice(0, 40)}"`); continue; }
    const item = { n: Number(first[1]), q: first[2].trim(), options: [], answer: '', why: '' };
    let mode = 'q';
    for (const l of lines.slice(1)) {
      const t = l.trim();
      const om = t.match(/^([A-D])\)\s+(.*)$/);
      if (om) { item.options.push(om[2].trim()); mode = 'o'; continue; }
      if (/^Answer:/i.test(t)) { item.answer = t.replace(/^Answer:\s*/i, ''); mode = 'a'; continue; }
      if (/^Why:/i.test(t)) { item.why = t.replace(/^Why:\s*/i, ''); mode = 'w'; continue; }
      if (!t) continue;
      if (mode === 'q') item.q += '\n' + t;
      else if (mode === 'a') item.answer += '\n' + t;
      else if (mode === 'w') item.why += '\n' + t;
    }
    const mk = item.q.match(/\((\d+)\s*marks?\)/i);
    item.marks = mk ? Number(mk[1]) : 1;
    items.push(item);
  }
  return items;
}

export function loadLessons(dir) {
  const ldir = join(dir, 'lessons');
  if (!existsSync(ldir)) return [];
  return readdirSync(ldir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const text = readFileSync(join(ldir, f), 'utf8');
    return { file: f, ...parseLesson(text, f) };
  });
}

export function loadBank(dir) {
  const bdir = join(dir, 'bank');
  const bank = { mcq: [], short: [], errors: [] };
  if (!existsSync(bdir)) return bank;
  for (const f of readdirSync(bdir).filter((x) => x.endsWith('.json')).sort()) {
    try {
      const d = JSON.parse(readFileSync(join(bdir, f), 'utf8'));
      for (const q of d.mcq || []) bank.mcq.push({ ...q, _file: f });
      for (const q of d.short || []) bank.short.push({ ...q, _file: f });
    } catch (e) { bank.errors.push(`${f}: invalid JSON (${e.message})`); }
  }
  return bank;
}
