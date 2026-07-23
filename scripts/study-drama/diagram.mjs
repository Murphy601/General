/**
 * DIAGRAM SPEC — emit renderable blocks for lessons and exams.
 * UI converts PAYLOAD to visible figures; students should not see raw code as the lesson.
 */
export function diagramBlock({ type = 'svg', purpose, alt, payload, caption, figureNumber = 1 }) {
  return [
    '[DIAGRAM]',
    `TYPE: ${type}`,
    `PURPOSE: ${purpose}`,
    `ALT: ${alt}`,
    'PAYLOAD:',
    payload,
    `CAPTION: Figure ${figureNumber}: ${caption}`,
    '[/DIAGRAM]',
  ].join('\n');
}

/** Simple labeled pressure diagram as SVG */
export function pressureForceAreaSvg({ F = 200, A = 0.5 } = {}) {
  return diagramBlock({
    type: 'svg',
    purpose: `Show force F = ${F} N acting on area A = ${A} m² with P = F/A labeled.`,
    alt: `Force arrow of ${F} newtons pressing on a rectangular area of ${A} square metres.`,
    caption: 'Force on an area for pressure',
    payload: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180" role="img">
  <rect x="80" y="110" width="160" height="40" fill="#e8f5e9" stroke="#1b5e20" stroke-width="2"/>
  <text x="160" y="135" text-anchor="middle" font-size="14" fill="#1b5e20">A = ${A} m²</text>
  <line x1="160" y1="30" x2="160" y2="105" stroke="#b71c1c" stroke-width="3" marker-end="url(#arrow)"/>
  <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#b71c1c"/></marker></defs>
  <text x="175" y="60" font-size="14" fill="#b71c1c">F = ${F} N</text>
  <text x="160" y="170" text-anchor="middle" font-size="13" fill="#333">P = F / A</text>
</svg>`,
  });
}

/** States of matter particle sketch as figure-prompt (renderer) */
export function statesParticlePrompt() {
  return diagramBlock({
    type: 'figure-prompt',
    purpose: 'Three panels: solid packed vibrating particles; liquid sliding particles; gas sparse free particles.',
    alt: 'Particle model comparing solid, liquid and gas arrangements.',
    caption: 'Particle arrangement in the three states',
    payload:
      'Clean educational diagram, three equal panels labeled Solid / Liquid / Gas. Solid: tightly packed dots vibrating in place. Liquid: close dots sliding. Gas: sparse dots with motion arrows filling the box. White background, clear black labels, no decorative clutter, curriculum textbook style.',
  });
}

/** Fire triangle SVG */
export function fireTriangleSvg() {
  return diagramBlock({
    type: 'svg',
    purpose: 'Equilateral triangle labeled Fuel, Heat, Oxygen at the three sides.',
    alt: 'Fire triangle with sides Fuel, Heat and Oxygen.',
    caption: 'The fire triangle',
    payload: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 220" width="300" height="220" role="img">
  <polygon points="150,20 280,190 20,190" fill="#fff8e1" stroke="#e65100" stroke-width="3"/>
  <text x="150" y="100" text-anchor="middle" font-size="14" fill="#e65100">FIRE</text>
  <text x="150" y="40" text-anchor="middle" font-size="13">Heat</text>
  <text x="55" y="150" font-size="13">Fuel</text>
  <text x="200" y="150" font-size="13">Oxygen</text>
</svg>`,
  });
}

/** Number line for place value / inequalities / ordering */
export function numberLineSvg({ from = 0, to = 10, mark = 4 } = {}) {
  const mid = ((mark - from) / (to - from)) * 260 + 30;
  return diagramBlock({
    type: 'svg',
    purpose: `Number line from ${from} to ${to} with a mark at ${mark}.`,
    alt: `Number line marked at ${mark} between ${from} and ${to}.`,
    caption: `Number line (${from} to ${to})`,
    payload: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 90" width="320" height="90" role="img">
  <line x1="20" y1="40" x2="300" y2="40" stroke="#333" stroke-width="2"/>
  <polygon points="300,40 290,34 290,46" fill="#333"/>
  <text x="20" y="70" font-size="12">${from}</text>
  <text x="280" y="70" font-size="12">${to}</text>
  <circle cx="${mid}" cy="40" r="5" fill="#1565c0"/>
  <text x="${mid}" y="28" text-anchor="middle" font-size="12" fill="#1565c0">${mark}</text>
</svg>`,
  });
}

/** Rectangle with L and W labeled for perimeter/area */
export function rectangleMeasureSvg({ L = 8, W = 3, unit = 'cm' } = {}) {
  return diagramBlock({
    type: 'svg',
    purpose: `Rectangle labeled length ${L} ${unit} and width ${W} ${unit}.`,
    alt: `Rectangle ${L} by ${W} ${unit}.`,
    caption: `Rectangle ${L} ${unit} × ${W} ${unit}`,
    payload: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" width="320" height="160" role="img">
  <rect x="40" y="30" width="220" height="90" fill="#e3f2fd" stroke="#0d47a1" stroke-width="2"/>
  <text x="150" y="25" text-anchor="middle" font-size="13">L = ${L} ${unit}</text>
  <text x="275" y="80" font-size="13">W = ${W} ${unit}</text>
  <text x="150" y="140" text-anchor="middle" font-size="12" fill="#333">P = 2(L+W) · Area = L×W</text>
</svg>`,
  });
}

/** Fraction bar showing shaded part */
export function fractionBarSvg({ parts = 4, shaded = 1 } = {}) {
  const w = 240 / parts;
  let rects = '';
  for (let i = 0; i < parts; i++) {
    const fill = i < shaded ? '#81c784' : '#fff';
    rects += `<rect x="${40 + i * w}" y="40" width="${w}" height="50" fill="${fill}" stroke="#2e7d32" stroke-width="2"/>`;
  }
  return diagramBlock({
    type: 'svg',
    purpose: `Fraction bar divided into ${parts} equal parts with ${shaded} shaded (= ${shaded}/${parts}).`,
    alt: `Bar divided into ${parts} parts with ${shaded} shaded.`,
    caption: `Fraction ${shaded}/${parts}`,
    payload: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" width="320" height="120" role="img">
  ${rects}
  <text x="160" y="110" text-anchor="middle" font-size="14">${shaded}/${parts} shaded</text>
</svg>`,
  });
}

/** Right triangle for Pythagoras */
export function rightTriangleSvg({ a = 3, b = 4, c = 5 } = {}) {
  return diagramBlock({
    type: 'svg',
    purpose: `Right-angled triangle with legs ${a}, ${b} and hypotenuse ${c}.`,
    alt: `Right triangle ${a}-${b}-${c}.`,
    caption: `Right-angled triangle (${a}, ${b}, ${c})`,
    payload: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="280" height="200" role="img">
  <polygon points="40,160 200,160 40,40" fill="#fff3e0" stroke="#e65100" stroke-width="2"/>
  <rect x="40" y="145" width="15" height="15" fill="none" stroke="#e65100" stroke-width="2"/>
  <text x="120" y="180" text-anchor="middle" font-size="13">${b}</text>
  <text x="25" y="100" font-size="13">${a}</text>
  <text x="140" y="90" font-size="13">${c}</text>
  <text x="140" y="30" text-anchor="middle" font-size="12">c² = a² + b²</text>
</svg>`,
  });
}

/** Simple plant/animal cell figure prompt */
export function cellDiagramPrompt({ kind = 'plant' } = {}) {
  const isPlant = kind === 'plant';
  return diagramBlock({
    type: 'figure-prompt',
    purpose: isPlant
      ? 'Labeled plant cell: cell wall, membrane, cytoplasm, nucleus, vacuole, chloroplasts.'
      : 'Labeled animal cell: membrane, cytoplasm, nucleus, mitochondria.',
    alt: isPlant ? 'Labeled plant cell diagram' : 'Labeled animal cell diagram',
    caption: isPlant ? 'Plant cell' : 'Animal cell',
    payload: isPlant
      ? 'Clean textbook diagram of a plant cell with clear labels for cell wall, cell membrane, cytoplasm, nucleus, large vacuole and chloroplasts. White background, black outlines, no clutter.'
      : 'Clean textbook diagram of an animal cell with clear labels for cell membrane, cytoplasm, nucleus and mitochondria. White background, black outlines, no clutter.',
  });
}

/** Water cycle / environment figure prompt */
export function cyclePrompt({ title = 'Water cycle' } = {}) {
  return diagramBlock({
    type: 'figure-prompt',
    purpose: `${title} with labeled arrows for key stages.`,
    alt: `${title} diagram with stages labeled.`,
    caption: title,
    payload: `Clean educational diagram of the ${title} with labeled arrows, simple icons, white background, curriculum textbook style, no decorative clutter.`,
  });
}

/** Generic labeled concept diagram prompt */
export function conceptPrompt({ title, detail }) {
  return diagramBlock({
    type: 'figure-prompt',
    purpose: detail || `Illustrate ${title} for CBC learners.`,
    alt: `Diagram illustrating ${title}.`,
    caption: title,
    payload: `Clean educational textbook diagram illustrating "${title}". ${detail || 'Clear labels, simple shapes, Kenyan classroom context where useful.'} White background, no decorative clutter.`,
  });
}

/**
 * Pick a diagram for a lesson page from subject/topic keywords.
 * Returns null when no diagram fits.
 */
export function pickDiagram({ subject = '', topicName = '', pageTitle = '', pageNumber = 1, variant = 0 }) {
  const blob = `${subject} ${topicName} ${pageTitle}`.toLowerCase();
  const n = pageNumber + variant;

  if (/pressure|force and area|p = f/.test(blob)) return pressureForceAreaSvg({ F: 100 + (n % 5) * 50, A: [0.2, 0.25, 0.5, 0.4][n % 4] });
  if (/fire|combustion|extinguish/.test(blob)) return fireTriangleSvg();
  if (/state of matter|solid|liquid|gas|particle/.test(blob) && /science|matter|change/.test(blob)) return statesParticlePrompt();
  if (/plant cell|chloroplast|vacuole/.test(blob)) return cellDiagramPrompt({ kind: 'plant' });
  if (/animal cell|mitochondria|nucleus/.test(blob) && /cell/.test(blob)) return cellDiagramPrompt({ kind: 'animal' });
  if (/water cycle|nitrogen cycle|carbon cycle/.test(blob)) return cyclePrompt({ title: blob.match(/water cycle|nitrogen cycle|carbon cycle/)[0] });
  if (/pythagoras|hypotenuse|right.?angl/.test(blob)) return rightTriangleSvg();
  if (/fraction|part of a whole|numerator|denominator/.test(blob)) return fractionBarSvg({ parts: 4 + (n % 3), shaded: 1 + (n % 3) });
  if (/perimeter|area|rectangle|length|width/.test(blob) && /math|measure|geometry/.test(blob + subject.toLowerCase())) {
    return rectangleMeasureSvg({ L: 6 + (n % 6), W: 2 + (n % 4) });
  }
  if (/number line|inequal|order|place value|whole number/.test(blob)) {
    return numberLineSvg({ from: 0, to: 10 + (n % 10), mark: 2 + (n % 8) });
  }

  // Rotate useful defaults on selected pages (every 4th) so most topics get visuals
  if (pageNumber % 4 === 1) {
    if (/math|numeracy|arithmetic/.test(subject.toLowerCase())) {
      const picks = [
        () => numberLineSvg({ from: 0, to: 20, mark: 5 + (n % 10) }),
        () => rectangleMeasureSvg({ L: 5 + (n % 8), W: 2 + (n % 5) }),
        () => fractionBarSvg({ parts: 5, shaded: 2 + (n % 2) }),
      ];
      return picks[n % picks.length]();
    }
    if (/science|biology|chemistry|physics|agricult|environment/.test(subject.toLowerCase())) {
      const picks = [
        () => statesParticlePrompt(),
        () => cellDiagramPrompt({ kind: n % 2 ? 'plant' : 'animal' }),
        () => conceptPrompt({ title: topicName || pageTitle, detail: 'Show the main parts or process with clear labels.' }),
        () => cyclePrompt({ title: topicName || 'Process cycle' }),
      ];
      return picks[n % picks.length]();
    }
    if (/geo|social|history|map/.test(subject.toLowerCase() + blob)) {
      return conceptPrompt({
        title: topicName || pageTitle,
        detail: 'Simple map, timeline, or labeled community diagram with a key/legend.',
      });
    }
    return conceptPrompt({
      title: pageTitle || topicName || subject,
      detail: 'Show the key idea with 3–5 clear labels a Grade learner can copy into an exercise book.',
    });
  }
  return null;
}
