/**
 * Topic-aware teaching notes + worked examples when curriculum text is
 * syllabus/OCR fragments rather than student-ready prose.
 */
import { formatWorking } from './math-working.mjs';
import { toUnicodeFormula } from './house-style.mjs';

function blobOf(page, topic) {
  return `${page?.title || ''} ${topic?.topicName || ''} ${topic?.subject || ''}`.toLowerCase();
}

/** True if a “fact” looks like broken syllabus/OCR text */
export function isJunkFact(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (s.length < 28) return true;
  if (/page\s+\d+\s+of\s+\d+/i.test(s)) return true;
  if (/^[•]\s*/.test(s)) return true;
  if (/,\s*\.?$/.test(s)) return true; // "Determine the heat capacity,."
  if (/^(of|and|or|using|to|the|a|an)\b/i.test(s) && s.split(/\s+/).length < 10) return true;
  if ((s.match(/,/g) || []).length >= 2 && !/[.!?].*\w/.test(s.slice(0, 40))) return true;
  // Fragment lists without a real sentence verb
  if (/^(heat capacity|specific heat|latent heat|specific latent)/i.test(s) && s.split(/\s+/).length <= 6) {
    return true;
  }
  if (/\b(derive and use the formulae|terminologies used)\b/i.test(s) && s.length < 80) return true;
  // Ends mid-phrase
  if (/\b(using a|of various|and the|from the)\.?$/i.test(s)) return true;
  return false;
}

/**
 * Build real teaching notes for known quantitative science/math topics.
 * Returns null if no specialised bank matches (caller falls back).
 */
export function teachNotes({ page, topic, variant = 0 }) {
  const blob = blobOf(page, topic);
  const v = Math.abs(Number(variant) || 0);

  // ---- Quantity of heat / thermal ----
  if (/quantity of heat|specific heat capacity|heat capacity|latent heat|calorimeter|thermal capacity/.test(blob)) {
    if (/latent/.test(blob) && !/specific heat/.test(blob)) {
      return [
        'Latent heat is the heat energy absorbed or released during a change of state at constant temperature.',
        toUnicodeFormula('Quantity of heat for a change of state: Q = mL, where m is mass and L is specific latent heat.'),
        'Specific latent heat of fusion (L_f) is heat to change 1 kg solid ↔ liquid at melting point without temperature change.',
        'Specific latent heat of vaporisation (L_v) is heat to change 1 kg liquid ↔ vapour at boiling point without temperature change.',
        'During melting or boiling the thermometer reading stays steady while heat is still being supplied — that heat is latent heat.',
        'Units: Q in joules (J), m in kg, L in J/kg (or J/g if mass is in grams — keep units consistent).',
      ];
    }
    if (/specific heat/.test(blob) || /applications/.test(blob)) {
      return [
        'Specific heat capacity (c) is the heat needed to raise the temperature of 1 kg of a substance by 1 K (or 1 °C).',
        toUnicodeFormula('Formula: Q = mcΔθ  (also written Q = mcΔT), where Δθ is the temperature change.'),
        'Heat capacity (C) of a body is the heat needed to raise that whole body’s temperature by 1 K: C = mc = Q/Δθ.',
        'Different materials store heat differently — water has a high specific heat capacity, so it heats and cools slowly.',
        'In calorimetry, heat lost by a hot body equals heat gained by a cold body and calorimeter (if no heat escapes).',
        'Always convert mass to kg (or keep g consistently) and use °C or K differences the same way (Δθ size is identical).',
      ];
    }
    return [
      'Quantity of heat (Q) measures thermal energy transferred because of a temperature difference or a change of state.',
      toUnicodeFormula('Temperature change (no change of state): Q = mcΔθ.'),
      toUnicodeFormula('Heat capacity of an object: C = Q/Δθ = mc.'),
      toUnicodeFormula('Change of state at constant temperature: Q = mL.'),
      'Never confuse heat (energy in joules) with temperature (°C or K). Heat can flow while temperature stays constant during a change of state.',
      'Show method: identify process → pick formula → substitute with units → compute → check whether the answer size is sensible.',
    ];
  }

  // ---- Pressure ----
  if (/pressure|force\b|pascal|newton|area/.test(blob) && /science|physics|integrated/i.test(topic.subject || blob)) {
    return [
      'Pressure is force acting normally per unit area.',
      toUnicodeFormula('P = F / A, with P in pascals (Pa = N/m²).'),
      'For the same force, a smaller area gives a larger pressure (why a sharp knife cuts easily).',
      'Atmospheric pressure and liquid pressure also matter in physics — liquid pressure increases with depth.',
      'Always use SI units: force in newtons, area in square metres, before substituting.',
    ];
  }

  // ---- Electricity basics ----
  if (/current|voltage|resistance|ohm|circuit|electric/.test(blob)) {
    return [
      'Electric current is the rate of flow of charge; potential difference (voltage) drives that flow.',
      toUnicodeFormula('Ohm’s law (ohmic conductors): V = IR.'),
      toUnicodeFormula('Power: P = VI = I²R = V²/R.'),
      'Series: same current through each component; parallel: same voltage across branches.',
      'Use correct units: V in volts, I in amperes, R in ohms, P in watts.',
    ];
  }

  // ---- Waves / light ----
  if (/wave|frequency|wavelength|sound|light|refraction|reflection/.test(blob)) {
    return [
      'A wave transfers energy without transferring matter permanently from place to place.',
      toUnicodeFormula('Wave speed: v = fλ, where f is frequency and λ is wavelength.'),
      'Frequency is waves per second (Hz); period T = 1/f.',
      'Reflection, refraction and diffraction are wave behaviours you must name accurately in exams.',
      'Keep units consistent: v in m/s, λ in m, f in Hz.',
    ];
  }

  // ---- Cells / biology ----
  if (/cell|microscope|osmosis|diffusion|photosynthesis|organelle/.test(blob)) {
    return [
      'The cell is the basic structural and functional unit of living organisms.',
      'Plant cells have a cell wall and usually chloroplasts; animal cells do not.',
      'Diffusion is net movement of particles from high to low concentration; osmosis is water through a selectively permeable membrane.',
      'Magnification = eyepiece power × objective power — multiply, never add.',
      'Use correct biology words: membrane, nucleus, cytoplasm, vacuole, chloroplast.',
    ];
  }

  // ---- Chemistry matter ----
  if (/element|compound|mixture|atom|molecule|periodic|bond|acid|base|salt|reaction/.test(blob)) {
    return [
      'An element contains only one type of atom; a compound contains two or more elements chemically joined in a fixed ratio.',
      'Mixtures can usually be separated by physical methods; compounds need chemical change to separate into elements.',
      'Chemical symbols: first letter capital, second letter (if any) small — Co is cobalt, CO is carbon monoxide.',
      'Always balance the idea: atoms rearrange in reactions; mass is conserved in a closed system.',
      'Name the process accurately: physical change vs chemical change.',
    ];
  }

  // ---- Generic science fallback for science subjects ----
  if (/science|physics|chemistry|biology|agriculture|home science/i.test(topic.subject || '')) {
    const name = topic.topicName || page.title || 'this idea';
    return [
      `${name} is a science idea you must define accurately, apply with a method, and check with units or labeled steps.`,
      `Start every answer with the correct definition or formula linked to ${name}.`,
      'Then substitute known values (or name the observation), show clear steps, and state the final answer with units or science words.',
      'Common exam trap: mixing this idea with a neighbouring concept that uses similar words but a different formula or meaning.',
      'Safety and honesty matter: never invent data; report what the method actually shows.',
      `Revise by teaching ${name} out loud in one minute, then solving one numerical or labeled example.`,
    ];
  }

  return null;
}

/**
 * Worked numerical/science example for the page. Returns null to use caller default.
 */
export function teachWorked({ page, topic, variant = 0 }) {
  const blob = blobOf(page, topic);
  const v = Math.abs(Number(variant) || 0);

  if (/quantity of heat|specific heat capacity|heat capacity|latent heat|calorimeter|thermal/.test(blob)) {
    if (/latent/.test(blob) && !/specific heat capacity/.test(blob)) {
      const m = 0.2 + (v % 4) * 0.1; // kg
      const L = 334000; // J/kg ice fusion approx, or use 2.26e6 for steam — pick fusion for mid values
      const useSteam = v % 2 === 1;
      const Lv = useSteam ? 2260000 : 334000;
      const label = useSteam ? 'specific latent heat of vaporisation' : 'specific latent heat of fusion';
      const Q = m * Lv;
      return [
        `Worked example — ${label}:`,
        `Find the heat needed to change ${m} kg of ${useSteam ? 'water at 100 °C to steam' : 'ice at 0 °C to water'} (no temperature change).`,
        '',
        formatWorking({
          formula: 'Q = mL',
          substitution: `Q = ${m} × ${Lv}`,
          steps: [`Q = ${Q}`],
          finalAnswer: `${Q} J`,
          methodMarks: 'method mark for Q = mL; accuracy mark with joules',
        }),
        `Wrong path: using Q = mcΔθ here — temperature is constant during the change of state, so latent heat applies.`,
      ].join('\n');
    }
    // Specific heat / heat capacity numerical
    const m = 0.5 + (v % 5) * 0.25; // kg
    const c = [4200, 900, 390, 450][v % 4]; // water, Al, Cu-ish, iron-ish
    const dT = 10 + (v % 6) * 5;
    const Q = m * c * dT;
    const material = c === 4200 ? 'water' : c === 900 ? 'aluminium' : c === 390 ? 'copper' : 'iron';
    if (/heat capacity/.test(blob) && !/specific/.test(blob)) {
      const C = m * c;
      return [
        `Worked example — heat capacity:`,
        `A ${material} block of mass ${m} kg has specific heat capacity ${c} J/(kg·K). Find its heat capacity C, then the heat to raise temperature by ${dT} K.`,
        '',
        formatWorking({
          formula: 'C = mc  and  Q = CΔθ',
          substitution: `C = ${m} × ${c};  Q = C × ${dT}`,
          steps: [`C = ${C} J/K`, `Q = ${C} × ${dT}`, `Q = ${Q} J`],
          finalAnswer: `C = ${C} J/K; Q = ${Q} J`,
          methodMarks: 'method marks for C = mc and Q = CΔθ; accuracy marks',
        }),
        'Wrong path: forgetting that heat capacity C belongs to the whole object (mc), while specific heat capacity c is per kilogram.',
      ].join('\n');
    }
    return [
      `Worked example — specific heat capacity:`,
      `How much heat is needed to raise the temperature of ${m} kg of ${material} by ${dT} °C? (c = ${c} J/(kg·°C))`,
      '',
      formatWorking({
        formula: 'Q = mcΔθ',
        substitution: `Q = ${m} × ${c} × ${dT}`,
        steps: [`Q = ${m * c} × ${dT}`, `Q = ${Q}`],
        finalAnswer: `${Q} J`,
        methodMarks: 'method mark for Q = mcΔθ; accuracy mark with joules',
      }),
      'Wrong path: using Q = mL (latent heat) when temperature is changing and there is no change of state.',
    ].join('\n');
  }

  if (/pressure|force\b/.test(blob) && /physics|science|integrated/i.test(topic.subject || blob)) {
    const F = 100 + (v % 5) * 40;
    const A = [0.2, 0.25, 0.5, 0.4][v % 4];
    return [
      `Worked example — pressure:`,
      `A force of ${F} N acts normally on an area of ${A} m². Find the pressure.`,
      '',
      formatWorking({
        formula: 'P = F / A',
        substitution: `P = ${F} / ${A}`,
        steps: [`P = ${F / A}`],
        finalAnswer: `${F / A} Pa`,
        methodMarks: 'method mark for P = F/A; accuracy mark with Pa',
      }),
    ].join('\n');
  }

  if (/current|voltage|resistance|ohm|circuit/.test(blob)) {
    const V = 6 + (v % 5) * 2;
    const R = 2 + (v % 6);
    const I = V / R;
    return [
      `Worked example — Ohm’s law:`,
      `A conductor has resistance ${R} Ω and potential difference ${V} V. Find the current.`,
      '',
      formatWorking({
        formula: 'I = V / R',
        substitution: `I = ${V} / ${R}`,
        steps: [`I = ${Number(I.toFixed(3))}`],
        finalAnswer: `${Number(I.toFixed(3))} A`,
        methodMarks: 'method mark for I = V/R; accuracy mark with amperes',
      }),
    ].join('\n');
  }

  if (/wave|frequency|wavelength|sound/.test(blob)) {
    const f = 50 + (v % 5) * 50;
    const lam = 0.5 + (v % 4) * 0.25;
    const speed = f * lam;
    return [
      `Worked example — wave equation:`,
      `A wave has frequency ${f} Hz and wavelength ${lam} m. Find its speed.`,
      '',
      formatWorking({
        formula: 'v = fλ',
        substitution: `v = ${f} × ${lam}`,
        steps: [`v = ${speed}`],
        finalAnswer: `${speed} m/s`,
        methodMarks: 'method mark for v = fλ; accuracy mark with m/s',
      }),
    ].join('\n');
  }

  if (/magnification|microscope/.test(blob)) {
    const eye = [5, 10, 15][v % 3];
    const obj = [4, 10, 40][v % 3];
    return [
      `Worked example — microscope magnification:`,
      '',
      formatWorking({
        formula: 'Total magnification = eyepiece × objective',
        substitution: `Total = ${eye} × ${obj}`,
        steps: [`Total = ${eye * obj}`],
        finalAnswer: `×${eye * obj}`,
        methodMarks: 'multiply lens powers; never add',
      }),
    ].join('\n');
  }

  return null;
}
