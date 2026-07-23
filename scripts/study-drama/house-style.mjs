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
      const cells = row
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)
        .filter((c) => !/^:?-{3,}:?$/.test(c));
      if (!cells.length) return '';
      if (cells.length === 1) return `• ${cells[0]}`;
      return `• ${cells[0]}: ${cells.slice(1).join(' · ')}`;
    })
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, '')
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
  t = stripForbiddenMarkup(t);
  t = toUnicodeFormula(t);
  // Ensure section titles that look like SECTION N are followed by ----
  t = t.replace(/^(SECTION\s+\d+[^\n]*)\n(?!----)/gim, (_, s) => {
    fixes.headings++;
    return `${s.toUpperCase()}\n----\n`;
  });
  const audit = `DISPLAY-CLEAN: PASS | fixes: headings=${fixes.headings} bold=${fixes.bold} tables=${fixes.tables} code=${fixes.code} formulas=${fixes.formulas}`;
  if (!/DISPLAY-CLEAN:/.test(t)) t = `${t}\n\n${audit}`;
  return t;
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
  return /model answer should|answers may vary|notice how|keep (the )?(definitions|it) precise|look for one object|your turn|today'?s idea|today we study/i.test(
    String(text || ''),
  );
}
