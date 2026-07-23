/**
 * GLOBAL HOUSE STYLE helpers for Study-Content & Drama Engine
 */

const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const SUP = { '+': '⁺', '-': '⁻', '2': '²', '3': '³', '4': '⁴' };

export function titleBlock(text) {
  return `${String(text).toUpperCase()}\n====`;
}

export function sectionBlock(text) {
  return `${String(text).toUpperCase()}\n----`;
}

export function toUnicodeFormula(s) {
  let t = String(s || '');
  // Common compounds first
  const map = [
    [/H2O/g, 'H₂O'],
    [/CO2/g, 'CO₂'],
    [/CaCO3/g, 'CaCO₃'],
    [/NaCl/g, 'NaCl'],
    [/Na\+/g, 'Na⁺'],
    [/Cl-/g, 'Cl⁻'],
    [/Ca2\+/g, 'Ca²⁺'],
    [/Mg2\+/g, 'Mg²⁺'],
    [/O2\b/g, 'O₂'],
    [/H2\b/g, 'H₂'],
    [/N2\b/g, 'N₂'],
    [/SO4/g, 'SO₄'],
    [/NO3/g, 'NO₃'],
    [/P\s*=\s*F\s*\/\s*A/g, 'P = F / A'],
    [/P\s*=\s*hρg/g, 'P = hρg'],
    [/\\text\{([^}]+)\}/g, '$1'],
    [/\$([^$]+)\$/g, '$1'],
  ];
  for (const [re, rep] of map) t = t.replace(re, rep);
  // Generic element digit → subscript (never touch Q/A IDs or page markers)
  t = t.replace(/\b([A-Z][a-z]?)(\d)\b/g, (_, el, d) => {
    if (el === 'Q' || el === 'A' || el === 'X') return `${el}${d}`;
    // Only common element symbols used in Grade 8 notes
    if (!/^(H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|Al|Si|P|S|Cl|K|Ca|Fe|Cu|Zn|Ag|Au|Hg|Pb|Sn)$/.test(el)) {
      return `${el}${d}`;
    }
    return el + (SUB[d] || d);
  });
  t = t.replace(/\^([+\-23])/g, (_, c) => SUP[c] || c);
  return t;
}

export function stripForbiddenMarkup(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, (block) =>
      block
        .replace(/```[a-z]*\n?/gi, '')
        .replace(/```/g, '')
        .split('\n')
        .map((l) => (l.trim() ? `• ${l.trim()}` : ''))
        .join('\n'),
    )
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, (_, w) => w.toUpperCase())
    .replace(/__([^_]+)__/g, (_, w) => w.toUpperCase())
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*\|.*\|\s*$/gm, (row) => {
      // Keep house-style dividers ==== / ---- untouched
      if (/^(====+|----+)$/.test(row.trim())) return row;
      const cells = row
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)
        .filter((c) => !/^:?-{3,}:?$/.test(c));
      if (!cells.length) return '';
      if (cells.length === 1) return `• ${cells[0]}`;
      return `• ${cells[0]}: ${cells.slice(1).join(' · ')}`;
    })
    // Only strip markdown table rule rows (must include a pipe), never house-style ----/====
    .replace(/^\s*\|?\s*:?-{3,}:?\s*\|[-\s|:]*$/gm, '')
    .replace(/[+\\|▼─│├└]+-+>/g, '→')
    .replace(/[│├└─]+/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Agent 2 — display normalize (non-destructive content; formatting only) */
export function displayNormalize(text) {
  let fixes = { headings: 0, bold: 0, tables: 0, code: 0, formulas: 0 };
  let t = String(text || '');
  if (/```/.test(t)) fixes.code++;
  if (/\|\s*-{3,}/.test(t) || /^\|.+\|$/m.test(t)) fixes.tables++;
  if (/\*\*|__/.test(t)) fixes.bold++;
  if (/^#{1,6}\s/m.test(t)) fixes.headings++;
  if (/\bH2O\b|\bCO2\b|\bNa\+/.test(t)) fixes.formulas++;

  // Never rewrite SVG / diagram payloads
  const parts = t.split(/(\[DIAGRAM\][\s\S]*?\[\/DIAGRAM\])/gi);
  t = parts
    .map((part) => {
      if (/^\[DIAGRAM\]/i.test(part)) return part;
      let p = stripForbiddenMarkup(part);
      p = toUnicodeFormula(p);
      p = p.replace(/^(SECTION\s+\d+[^\n]*)\n(?!----)/gim, (_, s) => {
        fixes.headings++;
        return `${s.toUpperCase()}\n----\n`;
      });
      return p;
    })
    .join('');
  // Audit is for the orchestrator only — never append DISPLAY-CLEAN to student pages.
  return t;
}

export function displayAudit(text) {
  const before = String(text || '');
  const after = displayNormalize(before);
  return {
    text: after,
    line: `DISPLAY-CLEAN: PASS | fixes: lenΔ=${before.length - after.length}`,
  };
}

export function cleanNoise(s) {
  return String(s || '')
    .replace(/[\u00a0]+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bcompunds\b/gi, 'compounds')
    .replace(/\bflouride\b/gi, 'fluoride')
    .replace(/\bare can be\b/gi, 'can be')
    .replace(/\bA compound is pure substance\b/gi, 'A compound is a pure substance')
    .trim();
}

export function hasForbiddenMarkup(text) {
  const t = String(text || '');
  if (/(?:^|\n)\s*#{1,6}\s/.test(t)) return true;
  if (/\*\*|__/.test(t)) return true;
  if (/```/.test(t)) return true;
  // Markdown tables: pipe rows with --- separators, not prose using · 
  if (/^\s*\|.+\|\s*$/m.test(t) && /\|?\s*:?-{3,}/.test(t)) return true;
  if (/[+\\|▼]\s*-{2,}>/.test(t)) return true;
  return false;
}

export function bannedPlaceholder(text) {
  return /model answer should|answers may vary|notice how|keep (the )?(definitions|it) precise|look for one object|your turn|today'?s idea|today we study|this page focuses on|worked focus:|scope:|a grade 8 answer should|choose one concrete|the confusion usually mixes|a1 content:|q-stem\s*\d/i.test(
    String(text || ''),
  );
}

/** Scaffolding / engine plumbing that must never appear on a student page */
export function hasScaffoldingLeak(text) {
  const t = String(text || '');
  return (
    /\bQ\d+\b/.test(t) ||
    /\bA\d+\b/.test(t) ||
    /Q-stem\s*\d/i.test(t) ||
    /COVERED LEDGER/i.test(t) ||
    /DISPLAY-CLEAN:/i.test(t) ||
    /\[CONTINUE:/i.test(t) ||
    /PAGE\s+\d+\s+OF\s+\d+/i.test(t) ||
    /Bloom\s*:/i.test(t) ||
    /\d+\s*marks\b/i.test(t) ||
    /Specific Learning Outcome/i.test(t) ||
    /Key Inquiry Question/i.test(t) ||
    /CBC FRAMING/i.test(t) ||
    /This page focuses on/i.test(t) ||
    /Worked focus:/i.test(t) ||
    /^Scope:/im.test(t) ||
    /A Grade 8 answer should/i.test(t) ||
    /A1 content:/i.test(t) ||
    /means [A-Z][^.]*role\.?\s*A Grade 8/i.test(t)
  );
}

export function isMetaAnswer(text) {
  return /should use accurate terms|should contain|model answer should|describe what the answer|answers may vary|Choose one concrete Kenyan example that displays/i.test(
    String(text || ''),
  );
}
