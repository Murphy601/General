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
  if (/^(demonstrate|determine|obtain|explain|derive)\b/i.test(s) && s.split(/\s+/).length <= 8) return true;
  if (/tropic and nastic\.?$/i.test(s) && s.split(/\s+/).length <= 6) return true;
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

  // ---- Plant response & coordination (BEFORE generic biology/cell) ----
  if (/response and coordination in plants|tropic|nastic|phototropism|geotropism|hydrotropism|thigmotropism|plant hormone|auxin/.test(blob)) {
    if (/nastic/.test(blob) && !/tropic/.test(blob)) {
      return [
        'Nastic responses are plant movements caused by a stimulus but the direction of movement does not depend on the direction of the stimulus.',
        'Example: many flowers open in the day and close at night (nyctinasty) — the response is not “towards” or “away from” light in a directional growth sense.',
        'Nastic movements are often temporary and may reverse when conditions change.',
        'Do not call every plant movement a tropism — tropisms are directional growth responses.',
        'Exam tip: state the stimulus, describe what the plant part does, and say clearly that the direction is independent of stimulus direction.',
      ];
    }
    if (/auxin|hormone/.test(blob)) {
      return [
        'Plant hormones (plant growth regulators) coordinate growth and responses; auxins are especially important in tropic growth.',
        'Auxin is produced mainly in shoot tips and moves down the shoot; unequal auxin distribution causes unequal cell elongation.',
        'In shoots, higher auxin on the shaded side promotes elongation there, so the shoot bends towards light (positive phototropism).',
        'In roots, auxin behaviour differs — roots usually show positive geotropism (grow downwards) and negative phototropism.',
        'Never say “plants have a brain” — coordination in plants is chemical (hormones) and growth-based, not a nervous system like animals.',
      ];
    }
    if (/photo/.test(blob)) {
      return [
        'Phototropism is a directional growth response to light.',
        'Shoots are usually positively phototropic (grow towards light), which helps leaves capture light for photosynthesis.',
        'Uneven light causes uneven auxin distribution; the side that elongates more makes the shoot curve towards the light.',
        'A classic investigation: seedlings with unilateral light bend towards the lamp; covered tips often fail to show the response.',
        'Common mistake: confusing phototropism (growth towards/away from light) with nastic opening/closing that is not directional growth.',
      ];
    }
    if (/geo|gravi/.test(blob)) {
      return [
        'Geotropism (gravitropism) is a directional growth response to gravity.',
        'Roots are usually positively geotropic (grow downwards); shoots are usually negatively geotropic (grow upwards).',
        'This helps roots reach water/minerals and shoots reach light.',
        'If a seedling is laid on its side, the root curves down and the shoot curves up — that is geotropism.',
        'Distinguish geotropism from hydrotropism (response to water) — they can act together in soil but are different stimuli.',
      ];
    }
    if (/hydro/.test(blob)) {
      return [
        'Hydrotropism is a directional growth response to water.',
        'Roots are often positively hydrotropic — they grow towards moisture.',
        'This increases the chance of absorbing water for photosynthesis and transport.',
        'In experiments, roots may bend towards a wet sponge even if gravity pulls another way — stimulus strength matters.',
        'Name the stimulus (water), the organ (root), and the direction (towards = positive).',
      ];
    }
    return [
      'Plants respond to stimuli (light, gravity, water, touch) and coordinate growth using plant hormones — they do not have animal-style nerves.',
      'Tropisms are directional growth responses: the direction of growth depends on the direction of the stimulus (positive = towards, negative = away).',
      'Key tropisms: phototropism (light), geotropism/gravitropism (gravity), hydrotropism (water), thigmotropism (touch, e.g. climbing tendrils).',
      'Nastic responses are non-directional: the movement pattern does not depend on stimulus direction (e.g. some flowers opening/closing).',
      'Auxin redistributed unevenly causes uneven elongation — that is how many tropic bends happen in shoots.',
      'Exam method: name stimulus → name organ → say positive/negative → give one clear example → reject one mix-up (tropism vs nastic).',
    ];
  }

  // ---- Nervous / animal coordination (avoid mixing with plants) ----
  if (/response and coordination|nervous|synapse|reflex|neurone|neuron|brain|spinal/.test(blob) && !/plant/.test(blob)) {
    return [
      'In animals, coordination often uses the nervous system: receptors detect stimuli, neurones carry impulses, effectors respond.',
      'A reflex arc is a fast automatic pathway: stimulus → receptor → sensory neurone → relay → motor neurone → effector.',
      'Synapses are junctions where the impulse is passed chemically between neurones.',
      'Do not describe plant tropisms using neurones — plants coordinate mainly with hormones and growth.',
      'Exam tip: sequence the arc correctly and name each part; missing the synapse or relay loses marks.',
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
    const isBio = /biology|agriculture|home science/i.test(topic.subject || '');
    if (isBio) {
      return [
        `${name} is a biology idea: define it with the correct scientific words, then give one clear living example.`,
        `State what causes the change or process in ${name}, and what structure or organism shows it.`,
        'Compare it with one near-miss idea that uses similar words but means something different.',
        'In practical work: observe carefully, record what actually happens, and do not invent results.',
        `Revise by teaching ${name} in one minute with: definition → example → common mistake.`,
      ];
    }
    return [
      `${name} is a science idea you must define accurately and apply with a clear method.`,
      `Start every answer with the correct definition or relationship linked to ${name}.`,
      'Then give a worked example or labeled steps, and check units or scientific wording.',
      'Common exam trap: mixing this idea with a neighbouring concept that uses similar words but a different meaning.',
      `Revise by teaching ${name} out loud, then checking one example against the notes.`,
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

  if (/response and coordination in plants|tropic|nastic|phototropism|geotropism|hydrotropism|thigmotropism|auxin/.test(blob)) {
    const scenes = [
      {
        title: 'phototropism in a shoot',
        steps: [
          'Observation: A potted seedling is lit from the left only. After two days the shoot tip bends left towards the lamp.',
          'Stimulus: unidirectional light.',
          'Response type: positive phototropism (directional growth towards light).',
          'Mechanism (exam level): auxin becomes uneven; the shaded side elongates more, so the shoot curves towards the light.',
          'Wrong idea to reject: “The plant walked towards the light” or “This is a nastic response” — the bend direction depends on light direction, so it is a tropism.',
          'Conclusion: Shoots show positive phototropism, which helps leaves gain light for photosynthesis.',
        ],
      },
      {
        title: 'geotropism in root and shoot',
        steps: [
          'Observation: A germinating seed is placed on its side. The radicle (young root) curves down; the plumule (young shoot) curves up.',
          'Stimulus: gravity.',
          'Response: root — positive geotropism; shoot — negative geotropism.',
          'Why it matters: roots reach water/minerals; shoots reach light and air.',
          'Wrong idea to reject: calling both organs “positively geotropic” — shoots grow against gravity.',
          'Conclusion: Geotropism is a directional growth response to gravity with opposite signs in root and shoot.',
        ],
      },
      {
        title: 'tropism vs nastic response',
        steps: [
          'Case A: Shoot bends towards a window — direction depends on light direction → tropism (phototropism).',
          'Case B: A flower opens in morning and closes at night — opening pattern is not “towards” a one-sided stimulus → nastic response.',
          'Decision rule: If growth direction depends on stimulus direction → tropism; if not → nastic.',
          'Wrong idea to reject: using “tropism” for every plant movement.',
          'Conclusion: Always name stimulus + whether the response is directional before you choose the term.',
        ],
      },
      {
        title: 'hydrotropism in roots',
        steps: [
          'Observation: In a choice chamber, roots grow towards a wet sponge rather than dry soil on the other side.',
          'Stimulus: water / moisture gradient.',
          'Response: positive hydrotropism.',
          'Link: Water uptake supports photosynthesis, transport and cell turgor.',
          'Wrong idea to reject: saying the root “smells water with nerves” — plants use growth responses, not animal neurones.',
          'Conclusion: Roots can be positively hydrotropic; name stimulus, organ and direction for full marks.',
        ],
      },
    ];
    const scene = scenes[v % scenes.length];
    return [`Worked example — ${scene.title}:`, '', ...scene.steps.map((s, i) => `${i + 1}. ${s}`)].join('\n');
  }

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

/**
 * Topic-specific conceptual revision Q&A (biology etc.) — not circular meta prompts.
 * Returns null when no specialised bank matches.
 */
export function teachRevisionQA({ page, topic, variant = 0 }) {
  const blob = blobOf(page, topic);
  const v = Math.abs(Number(variant) || 0);
  const topicName = topic?.topicName || 'this topic';

  if (/response and coordination in plants|tropic|nastic|phototropism|geotropism|hydrotropism|auxin/.test(blob)) {
    const packs = [
      {
        questions: [
          'DEFINE + EXAMPLE: What is a tropism? Give one named example in a shoot or root and state whether it is positive or negative.',
          'COMPARE: How does a tropism differ from a nastic response? Give one plant example of each.',
          'SPOT THE ERROR: A learner says “Plant shoots grow towards light because they have nerves like animals.” Correct the statement and explain the real mechanism at CBC level.',
        ],
        answers: [
          'A tropism is a directional growth response to a stimulus. Example: shoot growing towards light = positive phototropism (or root growing down = positive geotropism).',
          'Tropism: direction of growth depends on stimulus direction. Nastic: response pattern does not depend on stimulus direction. Examples: phototropism (tropism); flower opening/closing with day/night (nastic).',
          'Wrong: plants do not use animal neurones for this. Correct: shoots show positive phototropism; uneven auxin causes uneven elongation so the shoot bends towards light.',
        ],
      },
      {
        questions: [
          'CLASSIFY: Seedlings lit from one side bend towards the lamp. Name the stimulus, the response, and the organ showing it.',
          'EXPLAIN: Why is positive phototropism useful to a green plant?',
          'TRAP: “Roots always grow down only because of hydrotropism.” What is incomplete about that claim?',
        ],
        answers: [
          'Stimulus: light (unilateral). Response: positive phototropism. Organ: shoot / stem tip.',
          'It helps leaves and shoots gain light for photosynthesis, improving food manufacture.',
          'Roots also show positive geotropism (gravity). Hydrotropism is a response to water; both can matter, so naming only hydrotropism is incomplete.',
        ],
      },
      {
        questions: [
          'SEQUENCE: A shoot tip produces auxin. Light comes from the right. Describe how the shoot bends and why.',
          'DISTINGUISH: Positive geotropism vs negative geotropism — which organ usually shows which?',
          'EXAM (4 marks): Define tropism (1), name two tropisms (1), give one example with direction (1), state one difference from nastic responses (1).',
        ],
        answers: [
          'Auxin becomes higher on the shaded side; that side elongates more; the shoot bends towards the light (positive phototropism).',
          'Roots: usually positive geotropism (down). Shoots: usually negative geotropism (up).',
          'Tropism = directional growth response. Two of: photo/geo/hydro/thigmo. Example with +/−. Difference: nastic responses are not directional with respect to the stimulus.',
        ],
      },
    ];
    return packs[v % packs.length];
  }

  if (/biology/i.test(topic?.subject || '')) {
    return {
      questions: [
        `DEFINE: State the meaning of the main idea on this page within ${topicName} using correct biology words.`,
        `EXAMPLE: Describe one clear living example that shows this idea, and name the structure or organism involved.`,
        `SPOT THE ERROR: Give one wrong statement a learner might make about this page idea, correct it, and justify with a biology fact.`,
      ],
      answers: [
        `Give a precise biology definition for the page idea in ${topicName} (not a vague slogan).`,
        `Name a real organism/structure and what is observed; link it to the definition.`,
        `Wrong idea: mixing this concept with a neighbour. Correct with the accurate term and one justifying fact from the notes.`,
      ],
    };
  }

  return null;
}
