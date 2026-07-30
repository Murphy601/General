/**
 * Real calculation / working items for revision quizzes
 * (math, science, and other quantitative CBC subjects).
 */
import { formatWorking } from './math-working.mjs';
import { toUnicodeFormula } from './house-style.mjs';

export function needsCalcQuiz(subject, topicName = '', pageTitle = '') {
  const sub = String(subject || '').toUpperCase();
  const blob = `${topicName} ${pageTitle}`.toUpperCase();
  if (/MATH|NUMERACY|ARITHMETIC|ALGEBRA|GEOMETRY|TRIGONOMET|CALCULUS|STATISTICS|PROBABILITY/.test(sub)) return true;
  if (/PHYSICS|CHEMISTRY/.test(sub)) return true;
  if (/BUSINESS|ACCOUNT|ECONOMICS/.test(sub)) return true;
  if (/COMPUTER|PRE.?TECHNICAL|TECHNICAL/.test(sub) && /NUMBER|CALC|MEASURE|BINARY|LOGIC/.test(blob)) return true;
  if (/INTEGRATED\s*SCIENCE|SCIENCE/.test(sub)) {
    return /PRESSURE|FORCE|HEAT|ENERGY|ELECTRIC|CURRENT|MAGNET|DENSITY|WAVE|SPEED|MEASURE|MACHINE|LIGHT|SOUND|MATTER|ACID|SALT|REACTION/.test(
      `${sub} ${blob}`,
    );
  }
  if (/BIOLOGY|AGRICULTURE|HOME\s*SCIENCE/.test(sub)) {
    return /MAGNIFICATION|MICROSCOPE|RATE|PERCENT|RATIO|MEASURE|CALCULAT|POPULATION|YIELD/.test(blob);
  }
  if (/GEOGRAPHY/.test(sub) && /SCALE|MAP|DISTANCE|POPULATION|PERCENT|CLIMATE DATA|GRAPH/.test(blob)) return true;
  return false;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Build one concrete numerical question + full worked answer.
 * @returns {{ question: string, answer: string, kind: string }}
 */
export function buildCalcQuizItem({ subject = '', topicName = '', pageTitle = '', grade = '', variant = 0 }) {
  const blob = `${pageTitle} ${topicName} ${subject}`.toLowerCase();
  const v = Math.abs(Number(variant) || 0) + hash(blob) % 17;
  const isScience = /physics|chemistry|biology|science|agriculture|home science/i.test(subject);

  // ---- Thermal physics / quantity of heat (MUST be before volume|capacity) ----
  if (/quantity of heat|specific heat capacity|heat capacity|latent heat|calorimeter|thermal capacity/.test(blob) && isScience) {
    if (/latent/.test(blob) && !/specific heat/.test(blob)) {
      const m = Number((0.15 + (v % 5) * 0.05).toFixed(2));
      const L = v % 2 === 0 ? 334000 : 2260000;
      const kind = L > 1000000 ? 'vaporisation' : 'fusion';
      const Q = Math.round(m * L);
      return {
        kind: 'latent-heat',
        question: `CALCULATE: Find the heat required to change ${m} kg of substance during ${kind} if L = ${L} J/kg (temperature stays constant). Show full working.`,
        answer: [
          formatWorking({
            formula: 'Q = mL',
            substitution: `Q = ${m} × ${L}`,
            steps: [`Q = ${Q}`],
            finalAnswer: `${Q} J`,
            methodMarks: 'method mark for Q = mL; accuracy mark with joules',
          }),
          'Wrong path: using Q = mcΔθ — there is no temperature change during a pure change of state.',
        ].join('\n'),
      };
    }
    const m = Number((0.4 + (v % 5) * 0.2).toFixed(2));
    const c = [4200, 900, 390, 450][v % 4];
    const dT = 12 + (v % 5) * 4;
    const Q = Math.round(m * c * dT);
    if (/heat capacity/.test(blob) && !/specific/.test(blob)) {
      const C = Math.round(m * c);
      return {
        kind: 'heat-capacity',
        question: `CALCULATE: A body of mass ${m} kg has specific heat capacity ${c} J/(kg·K). Find (i) its heat capacity C and (ii) the heat needed to raise its temperature by ${dT} K. Show full working.`,
        answer: [
          formatWorking({
            formula: 'C = mc ; Q = CΔθ',
            substitution: `C = ${m} × ${c} ; Q = C × ${dT}`,
            steps: [`C = ${C} J/K`, `Q = ${C} × ${dT} = ${Q} J`],
            finalAnswer: `C = ${C} J/K ; Q = ${Q} J`,
            methodMarks: 'method marks for both formulae; accuracy marks',
          }),
          'Wrong path: treating heat capacity C as the same as specific heat capacity c.',
        ].join('\n'),
      };
    }
    return {
      kind: 'specific-heat',
      question: `CALCULATE: How much heat is needed to raise ${m} kg of a substance (c = ${c} J/(kg·°C)) by ${dT} °C? Show full working with units.`,
      answer: [
        formatWorking({
          formula: 'Q = mcΔθ',
          substitution: `Q = ${m} × ${c} × ${dT}`,
          steps: [`Q = ${m * c} × ${dT}`, `Q = ${Q}`],
          finalAnswer: `${Q} J`,
          methodMarks: 'method mark for Q = mcΔθ; accuracy mark with joules',
        }),
        'Wrong path: using Q = mL (latent heat) when temperature is changing with no change of state.',
      ].join('\n'),
    };
  }

  // ---- Algebra / equations / expressions ----
  if (/algebra|expression|equation|linear|solve|unknown|variable/.test(blob)) {
    const a = 2 + (v % 5);
    const b = 3 + (v % 7);
    const x = 4 + (v % 6);
    const mode = v % 3;
    if (mode === 0) {
      const rhs = a * x + b;
      return {
        kind: 'algebra-solve',
        question: `CALCULATE: Solve for x. Show full working.\n${a}x + ${b} = ${rhs}`,
        answer: [
          formatWorking({
            formula: 'Undo operations on both sides to isolate x',
            substitution: `${a}x + ${b} = ${rhs}`,
            steps: [`${a}x = ${rhs} − ${b}`, `${a}x = ${rhs - b}`, `x = ${rhs - b}/${a}`, `x = ${x}`, `Check: ${a}(${x}) + ${b} = ${rhs}`],
            finalAnswer: `x = ${x}`,
            methodMarks: 'method mark for isolating x; accuracy mark; check mark',
          }),
          `Wrong path: subtracting ${a} from ${rhs} instead of dividing, or forgetting to subtract ${b} first.`,
        ].join('\n'),
      };
    }
    if (mode === 1) {
      // Simplify expression by substituting
      const val = a * x + b * x;
      return {
        kind: 'algebra-simplify',
        question: `CALCULATE: Simplify and evaluate.\nIf x = ${x}, find the value of ${a}x + ${b}x. Show working.`,
        answer: [
          formatWorking({
            formula: 'Like terms: ax + bx = (a + b)x',
            substitution: `${a}x + ${b}x = (${a} + ${b})x`,
            steps: [`= ${a + b}x`, `Substitute x = ${x}: ${a + b} × ${x}`, `= ${val}`],
            finalAnswer: String(val),
            methodMarks: 'method mark for combining like terms; accuracy mark for substitution',
          }),
          `Wrong path: treating ${a}x + ${b}x as ${a + b} without the x, or computing ${a} + ${b} + ${x}.`,
        ].join('\n'),
      };
    }
    const expand = a * x + a * b;
    return {
      kind: 'algebra-expand',
      question: `CALCULATE: Expand and simplify.\n${a}(x + ${b})  then find the value when x = ${x}. Show working.`,
      answer: [
        formatWorking({
          formula: 'a(x + b) = ax + ab',
          substitution: `${a}(x + ${b}) = ${a}x + ${a * b}`,
          steps: [`When x = ${x}: ${a}(${x}) + ${a * b}`, `= ${a * x} + ${a * b}`, `= ${expand}`],
          finalAnswer: String(expand),
          methodMarks: 'method mark for expansion; accuracy mark for evaluation',
        }),
        `Wrong path: multiplying only the first term inside the brackets (${a} × x) and forgetting ${a} × ${b}.`,
      ].join('\n'),
    };
  }

  // ---- Fractions ----
  if (/fraction|ratio|proportion|part/.test(blob)) {
    const n1 = 1 + (v % 4);
    const d1 = 5 + (v % 4);
    const whole = d1 * (2 + (v % 3));
    const part = (n1 * whole) / d1;
    return {
      kind: 'fraction',
      question: `CALCULATE: A quantity is ${whole} units. Find ${n1}/${d1} of it. Show full working.`,
      answer: [
        formatWorking({
          formula: 'Fraction of a quantity = (numerator / denominator) × whole',
          substitution: `${n1}/${d1} of ${whole} = (${n1}/${d1}) × ${whole}`,
          steps: [`= ${n1} × (${whole}/${d1})`, `= ${n1} × ${whole / d1}`, `= ${part}`],
          finalAnswer: String(part),
          methodMarks: 'method mark for fraction of a quantity; accuracy mark',
        }),
        `Wrong path: multiplying ${n1} × ${whole} and ignoring the denominator ${d1}.`,
      ].join('\n'),
    };
  }

  // ---- Percent / decimal ----
  if (/percent|percentage|decimal|discount|interest|vat/.test(blob)) {
    const whole = 200 + (v % 6) * 50;
    const pct = 10 + (v % 5) * 5;
    const ans = (whole * pct) / 100;
    return {
      kind: 'percent',
      question: `CALCULATE: Find ${pct}% of ${whole}. Show full working.`,
      answer: [
        formatWorking({
          formula: 'Percentage amount = (percent / 100) × whole',
          substitution: `Amount = (${pct}/100) × ${whole}`,
          steps: [`= ${pct / 100} × ${whole}`, `= ${ans}`],
          finalAnswer: String(ans),
          methodMarks: 'method mark; accuracy mark',
        }),
        `Wrong path: computing ${pct} × ${whole} without dividing by 100.`,
      ].join('\n'),
    };
  }

  // ---- Perimeter / area / volume ----
  if (/perimeter|rectangle|length|width|boundary/.test(blob) && !/area|volume/.test(blob)) {
    const L = 6 + (v % 8);
    const W = 2 + (v % 5);
    const P = 2 * (L + W);
    return {
      kind: 'perimeter',
      question: `CALCULATE: A rectangular plot is ${L} m by ${W} m. Find the perimeter. Show full working with units.`,
      answer: [
        formatWorking({
          formula: 'Perimeter of rectangle = 2(L + W)',
          substitution: `P = 2(${L} + ${W})`,
          steps: [`P = 2(${L + W})`, `P = ${P}`],
          finalAnswer: `${P} m`,
          methodMarks: 'method mark for formula; accuracy mark with units',
        }),
        `Wrong path: computing L × W = ${L * W} (that is area, not perimeter).`,
      ].join('\n'),
    };
  }
  if (/area|square|surface/.test(blob) && !/volume/.test(blob)) {
    if (/square/.test(blob)) {
      const s = 5 + (v % 8);
      return {
        kind: 'area-square',
        question: `CALCULATE: A square has side ${s} m. Find the area. Show full working with units.`,
        answer: [
          formatWorking({
            formula: 'Area of square = side × side',
            substitution: `Area = ${s} × ${s}`,
            steps: [`Area = ${s * s}`],
            finalAnswer: `${s * s} m²`,
            methodMarks: 'method mark; accuracy mark with m²',
          }),
          `Wrong path: computing 4 × ${s} = ${4 * s} (that is perimeter of a square, not area).`,
        ].join('\n'),
      };
    }
    const L = 7 + (v % 6);
    const W = 3 + (v % 5);
    return {
      kind: 'area-rect',
      question: `CALCULATE: A rectangle measures ${L} cm by ${W} cm. Find the area. Show full working with units.`,
      answer: [
        formatWorking({
          formula: 'Area of rectangle = L × W',
          substitution: `Area = ${L} × ${W}`,
          steps: [`Area = ${L * W}`],
          finalAnswer: `${L * W} cm²`,
          methodMarks: 'method mark; accuracy mark with cm²',
        }),
        `Wrong path: computing 2(${L} + ${W}) = ${2 * (L + W)} (perimeter, not area).`,
      ].join('\n'),
    };
  }
  if (/(volume|litre|liter|cubic|cuboid|tank\b|container)/.test(blob) && !/heat capacity|specific heat|latent heat|quantity of heat/.test(blob)) {
    const l = 4 + (v % 5);
    const w = 3 + (v % 4);
    const h = 2 + (v % 3);
    return {
      kind: 'volume',
      question: `CALCULATE: A cuboid is ${l} cm by ${w} cm by ${h} cm. Find the volume. Show full working with units.`,
      answer: [
        formatWorking({
          formula: 'Volume of cuboid = l × w × h',
          substitution: `V = ${l} × ${w} × ${h}`,
          steps: [`V = ${l * w} × ${h}`, `V = ${l * w * h}`],
          finalAnswer: `${l * w * h} cm³`,
          methodMarks: 'method mark; accuracy mark with cm³',
        }),
        `Wrong path: adding ${l} + ${w} + ${h} instead of multiplying.`,
      ].join('\n'),
    };
  }

  // ---- Pythagoras / right triangle ----
  if (/pythagoras|hypotenuse|right.?angl|triangle/.test(blob)) {
    return {
      kind: 'pythagoras',
      question: 'CALCULATE: A right-angled triangle has legs 5 cm and 12 cm. Find the hypotenuse. Show full working.',
      answer: [
        formatWorking({
          formula: 'c² = a² + b²',
          substitution: 'c² = 5² + 12²',
          steps: ['c² = 25 + 144', 'c² = 169', 'c = 13'],
          finalAnswer: '13 cm',
          methodMarks: 'method mark for Pythagoras; accuracy mark for hypotenuse',
        }),
        'Wrong path: adding 5 + 12 = 17 without squaring.',
      ].join('\n'),
    };
  }

  // ---- Pressure (science) ----
  if (/pressure|force\b|pascal|newton/.test(blob)) {
    const F = 100 + (v % 5) * 40;
    const A = [0.2, 0.25, 0.5, 0.4][v % 4];
    const P = F / A;
    return {
      kind: 'pressure',
      question: `CALCULATE: A force of ${F} N acts on an area of ${A} m². Find the pressure. Show full working with units.`,
      answer: [
        formatWorking({
          formula: 'P = F / A',
          substitution: `P = ${F} N / ${A} m²`,
          steps: [`P = ${P}`],
          finalAnswer: `${P} Pa (N/m²)`,
          methodMarks: 'method mark for P = F/A; accuracy mark with Pa',
        }),
        `Wrong path: multiplying F × A = ${F * A} instead of dividing.`,
      ].join('\n'),
    };
  }

  // ---- Magnification ----
  if (/magnification|microscope|lens|eyepiece|objective/.test(blob)) {
    const eye = [5, 10, 15][v % 3];
    const obj = [4, 10, 40][v % 3];
    return {
      kind: 'magnification',
      question: `CALCULATE: An eyepiece is ×${eye} and an objective is ×${obj}. Find the total magnification. Show working.`,
      answer: [
        formatWorking({
          formula: 'Total magnification = eyepiece × objective',
          substitution: `Total = ${eye} × ${obj}`,
          steps: [`Total = ${eye * obj}`],
          finalAnswer: `×${eye * obj}`,
          methodMarks: 'method mark for multiply; never add lens powers',
        }),
        `Wrong path: adding ${eye} + ${obj} = ${eye + obj} instead of multiplying.`,
      ].join('\n'),
    };
  }

  // ---- Speed / distance / time ----
  if (/speed|velocity|distance|time|motion|rate/.test(blob)) {
    const dist = 60 + (v % 5) * 20;
    const time = 2 + (v % 4);
    const speed = dist / time;
    return {
      kind: 'speed',
      question: `CALCULATE: A journey covers ${dist} km in ${time} hours. Find the average speed. Show full working with units.`,
      answer: [
        formatWorking({
          formula: 'Speed = distance / time',
          substitution: `Speed = ${dist} km / ${time} h`,
          steps: [`Speed = ${speed}`],
          finalAnswer: `${speed} km/h`,
          methodMarks: 'method mark; accuracy mark with km/h',
        }),
        `Wrong path: multiplying ${dist} × ${time} = ${dist * time}.`,
      ].join('\n'),
    };
  }

  // ---- Density ----
  if (/density|mass|volume/.test(blob) && /science|physics|chem|integrated/i.test(subject)) {
    const m = 40 + (v % 5) * 10;
    const vol = 2 + (v % 4);
    return {
      kind: 'density',
      question: `CALCULATE: A sample has mass ${m} g and volume ${vol} cm³. Find the density. Show full working with units.`,
      answer: [
        formatWorking({
          formula: 'Density = mass / volume',
          substitution: `Density = ${m} g / ${vol} cm³`,
          steps: [`Density = ${m / vol}`],
          finalAnswer: `${m / vol} g/cm³`,
          methodMarks: 'method mark; accuracy mark with g/cm³',
        }),
        `Wrong path: multiplying mass × volume.`,
      ].join('\n'),
    };
  }

  // ---- Money / commercial arithmetic (NOT for pure science subjects) ----
  if (
    !isScience &&
    (/money|cost|price|buy|sell|profit|loss|budget|business|account|ksh|shop|market/.test(blob) ||
      needsCalcQuiz(subject, topicName, pageTitle))
  ) {
    const n = 8 + (v % 9);
    const p = 10 + (v % 8) * 5;
    const total = n * p;
    const mode = v % 3;
    if (mode === 0) {
      return {
        kind: 'money-total',
        question: `CALCULATE: A trader sells ${n} items at Ksh ${p} each. Find the total amount. Show full working.`,
        answer: [
          formatWorking({
            formula: 'Total = number × amount each',
            substitution: `Total = ${n} × ${p}`,
            steps: [`Total = ${total}`],
            finalAnswer: `Ksh ${total}`,
            methodMarks: 'method mark for multiplication; accuracy mark',
          }),
          `Wrong path: adding ${n} + ${p} = ${n + p} when equal groups need multiplication.`,
        ].join('\n'),
      };
    }
    if (mode === 1) {
      const cost = total;
      const sellEach = p + 5 + (v % 4);
      const sell = n * sellEach;
      const profit = sell - cost;
      return {
        kind: 'profit',
        question: `CALCULATE: ${n} items cost Ksh ${p} each and are sold at Ksh ${sellEach} each. Find the profit. Show full working.`,
        answer: [
          formatWorking({
            formula: 'Profit = selling price − cost price',
            substitution: `Cost = ${n} × ${p} = ${cost}; Selling = ${n} × ${sellEach} = ${sell}`,
            steps: [`Profit = ${sell} − ${cost}`, `Profit = ${profit}`],
            finalAnswer: `Ksh ${profit}`,
            methodMarks: 'method mark for both totals; accuracy mark for profit',
          }),
          `Wrong path: subtracting ${sellEach} − ${p} = ${sellEach - p} without multiplying by ${n}.`,
        ].join('\n'),
      };
    }
    const given = total + (v % 5) * 10;
    const change = given - total;
    return {
      kind: 'change',
      question: `CALCULATE: ${n} items at Ksh ${p} each are paid for with Ksh ${given}. Find the change. Show full working.`,
      answer: [
        formatWorking({
          formula: 'Change = money given − total cost',
          substitution: `Total cost = ${n} × ${p} = ${total}`,
          steps: [`Change = ${given} − ${total}`, `Change = ${change}`],
          finalAnswer: `Ksh ${change}`,
          methodMarks: 'method mark; accuracy mark',
        }),
        `Wrong path: forgetting to multiply ${n} × ${p} before subtracting.`,
      ].join('\n'),
    };
  }

  // ---- Science quantitative fallback (topic-aware; never Ksh trader) ----
  if (isScience) {
    if (/magnification|microscope|cell|biology/i.test(blob) || /biology/i.test(subject)) {
      const eye = [5, 10, 15][v % 3];
      const obj = [4, 10, 40][v % 3];
      return {
        kind: 'science-fallback-mag',
        question: `CALCULATE: Eyepiece ×${eye} and objective ×${obj}. Find total magnification. Show working.`,
        answer: [
          formatWorking({
            formula: 'Total magnification = eyepiece × objective',
            substitution: `Total = ${eye} × ${obj}`,
            steps: [`Total = ${eye * obj}`],
            finalAnswer: `×${eye * obj}`,
            methodMarks: 'multiply; never add',
          }),
          `Wrong path: adding ${eye} + ${obj}.`,
        ].join('\n'),
      };
    }
    const F = 80 + (v % 5) * 20;
    const A = [0.2, 0.25, 0.4, 0.5][v % 4];
    return {
      kind: 'science-fallback-pressure',
      question: `CALCULATE: A force of ${F} N acts on ${A} m². Find the pressure using P = F/A. Show full working.`,
      answer: [
        formatWorking({
          formula: 'P = F / A',
          substitution: `P = ${F} / ${A}`,
          steps: [`P = ${F / A}`],
          finalAnswer: `${F / A} Pa`,
          methodMarks: 'method mark; accuracy mark with Pa',
        }),
        'Wrong path: multiplying F × A instead of dividing.',
      ].join('\n'),
    };
  }

  // ---- Generic number operations for early math ----
  const a = 12 + (v % 9);
  const b = 3 + (v % 5);
  return {
    kind: 'operations',
    question: `CALCULATE: Work out ${a} × ${b} and then subtract ${b}. Show full working.`,
    answer: [
      formatWorking({
        formula: 'Follow the order: multiply first, then subtract',
        substitution: `${a} × ${b} − ${b}`,
        steps: [`${a} × ${b} = ${a * b}`, `${a * b} − ${b} = ${a * b - b}`],
        finalAnswer: String(a * b - b),
        methodMarks: 'method mark for order of operations; accuracy mark',
      }),
      `Wrong path: subtracting first (${a} − ${b}) then multiplying.`,
    ].join('\n'),
  };
}

/**
 * Build a mixed set of revision Q&A for a page.
 * For calc subjects: majority are real CALCULATE items with workings.
 */
export function buildCalcHeavyPageQA({ ideaLabel, topicName, subject, grade, notes, scope, variant = 0 }) {
  const idea = String(ideaLabel || topicName || 'this idea');
  const topic = String(topicName || 'this topic');
  const fact = toUnicodeFormula(notes?.[0] || scope || idea);
  const v = Math.abs(Number(variant) || 0);

  const c1 = buildCalcQuizItem({ subject, topicName: topic, pageTitle: idea, grade, variant: v });
  const c2 = buildCalcQuizItem({ subject, topicName: topic, pageTitle: idea, grade, variant: v + 11 });
  const c3 = buildCalcQuizItem({ subject, topicName: topic, pageTitle: `${topic} ${idea}`, grade, variant: v + 23 });

  const trapQ = `TRAP + CHECK: A learner gets a wrong answer on ${short(idea)} by skipping a method step. State a likely wrong path, then solve a correct numerical check linked to ${topic}.`;
  const trapA = [
    `Likely wrong path: jumping to an answer without formula/substitution, or mixing unlike operations.`,
    `Correct numerical check:`,
    c3.answer,
    `Supporting idea from notes: ${fact}`,
  ].join('\n');

  // Rotate so quizzes don't clone the same order every page
  const sets = [
    {
      questions: [c1.question, c2.question, trapQ],
      answers: [c1.answer, c2.answer, trapA],
    },
    {
      questions: [c2.question, trapQ, c1.question],
      answers: [c2.answer, trapA, c1.answer],
    },
    {
      questions: [c1.question, trapQ, c3.question],
      answers: [c1.answer, trapA, c3.answer],
    },
  ];
  return sets[v % sets.length];
}

function short(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .toLowerCase();
}
