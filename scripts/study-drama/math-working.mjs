/**
 * MATH WORKING RULE — formula → substitution → steps → final answer with units
 */
import { toUnicodeFormula } from './house-style.mjs';

/**
 * @param {{ formula: string, substitution: string, steps: string[], finalAnswer: string, methodMarks?: string }} opts
 */
export function formatWorking(opts) {
  const lines = [
    'Working:',
    `1. Formula / relationship: ${toUnicodeFormula(opts.formula)}`,
    `2. Substitute values: ${toUnicodeFormula(opts.substitution)}`,
    ...opts.steps.map((s, i) => `${i + 3}. ${toUnicodeFormula(s)}`),
    `Final Answer: ${toUnicodeFormula(opts.finalAnswer)}`,
  ];
  if (opts.methodMarks) {
    // Student-facing pages: avoid A1/M1 tokens (reserved for exam keys / orchestrator).
    const cleaned = String(opts.methodMarks)
      .replace(/\bM1\b/g, 'method mark')
      .replace(/\bA1\b/g, 'accuracy mark');
    lines.push(`Mark reminder: ${cleaned}`);
  }
  return lines.join('\n');
}

/** Pressure worked example with full working */
export function pressureWorking({ F, A, context }) {
  const P = F / A;
  return [
    context,
    '',
    formatWorking({
      formula: 'P = F / A',
      substitution: `P = ${F} N / ${A} m²`,
      steps: [`P = ${P}`],
      finalAnswer: `${P} Pa (N/m²)`,
      methodMarks: 'method mark for substituting into P = F / A; accuracy mark for correct Pa value',
    }),
  ].join('\n');
}

/** Magnification working */
export function magnificationWorking({ eyepiece, objective }) {
  const total = eyepiece * objective;
  return formatWorking({
    formula: 'Total magnification = eyepiece × objective',
    substitution: `Total = ${eyepiece} × ${objective}`,
    steps: [`Total = ${total}`],
    finalAnswer: `×${total}`,
    methodMarks: 'method mark for multiplying lens powers; accuracy mark for the × value',
  });
}

/** Money / count style working (for exams across subjects) */
export function productWorking({ label, a, b, unit }) {
  const product = a * b;
  return formatWorking({
    formula: `${label} = first quantity × second quantity`,
    substitution: `${label} = ${a} × ${b}`,
    steps: [`${label} = ${product}`],
    finalAnswer: unit ? `${unit} ${product}` : String(product),
    methodMarks: 'method mark for multiplication; accuracy mark for final answer',
  });
}
