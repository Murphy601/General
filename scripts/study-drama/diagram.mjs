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
