/**
 * Agent 3 — Screen-Drama / Episode Director
 * Acted scenes, story-specific cast, no recurring characters, no narration of notes.
 */
import { titleBlock, sectionBlock, toUnicodeFormula } from './house-style.mjs';

/** Fresh cast per topic — never reuse Dr. Amani / Jabali / Makena */
const CASTS = {
  '1.1': {
    title: 'THE LABEL THAT LIED',
    logline: 'A young shop helper misreads chemical names on salt and toothpaste labels and almost mixes the wrong advice for a customer.',
    setting: 'INT./EXT. neighbourhood duka and kitchen, present-day Kenya',
    characters: [
      { name: 'NZURI', line: '16, shop helper, curious, quick to guess', costume: 'school-clean blouse, apron' },
      { name: 'BIKE', line: 'duka owner, patient, precise', costume: 'checked shirt, calculator in pocket' },
      { name: 'AUNTIE HALIMA', line: 'customer buying salt and toothpaste', costume: 'kitenge, handbag' },
    ],
    goal: 'Nzuri wants to advise Auntie Halima correctly using element and compound knowledge',
    wrong: 'She treats NaCl as an element and writes CA for calcium',
    right: 'She uses capitalization rules and Latin roots to correct the labels',
    reflectionQ: 'Why must chemical symbols follow capitalization rules?',
    reflectionA: 'Q1/A1 from symbols pages — first letter capital, second lowercase',
  },
  '1.2': {
    title: 'ICE THAT WOULD NOT BURN',
    logline: 'Two cousins argue whether melting ice and burning paper are the same kind of change until a kitchen test settles it.',
    setting: 'INT. family kitchen, evening',
    characters: [
      { name: 'KEVO', line: '13, confident, jumps to conclusions', costume: 'hoodie, slippers' },
      { name: 'LULU', line: '14, careful observer', costume: 't-shirt, notebook' },
      { name: 'MAMA ROSE', line: 'parent supervising safely', costume: 'house dress, oven gloves' },
    ],
    goal: 'Prove whether melting and burning are physical or chemical changes',
    wrong: 'Kevo claims both are chemical because both “change” the substance',
    right: 'Lulu shows ice→water is still H₂O; burnt paper makes new ash/gases',
    reflectionQ: 'How do you tell a physical change from a chemical change?',
    reflectionA: 'New substance formed or not; reversibility clues',
  },
  '1.3': {
    title: 'THE WRONG BUCKET',
    logline: 'A market stall fire nearly worsens when someone reaches for water until the fire triangle and class rules redirect the response.',
    setting: 'EXT. open-air market stall, afternoon',
    characters: [
      { name: 'OWINO', line: 'stall helper, brave but untrained', costume: 'cap, apron' },
      { name: 'SERGEANT ACHIENG', line: 'nearby safety marshal', costume: 'high-vis vest' },
      { name: 'TRADER MUTHONI', line: 'stall owner', costume: 'lesso, sturdy shoes' },
    ],
    goal: 'Stop a small Class B fuel spill fire without making it worse',
    wrong: 'Owino throws water on burning oil/petrol-soaked rags',
    right: 'They cut fuel/oxygen appropriately and evacuate, matching fire class',
    reflectionQ: 'Why is water unsuitable for some fire classes?',
    reflectionA: 'Petrol/electrical fires can worsen with water',
  },
  '2.1': {
    title: 'THE BLURRY ONION',
    logline: 'A student cannot see onion cells until she learns microscope parts and magnification, then finally draws a clear plant cell.',
    setting: 'INT. school science lab',
    characters: [
      { name: 'FAITH', line: 'Grade 8 learner, frustrated then concerned', costume: 'school sweater' },
      { name: 'MR. OTIENO', line: 'lab teacher, calm coach', costume: 'lab coat' },
      { name: 'BRIAN', line: 'lab partner who rushes focusing', costume: 'school shirt' },
    ],
    goal: 'Obtain a clear view and labelled drawing of plant cells',
    wrong: 'Brian cranks the high power first and squashes the slide',
    right: 'Faith starts low power, calculates magnification, focuses carefully',
    reflectionQ: 'How do you calculate total magnification?',
    reflectionA: 'Eyepiece × objective',
  },
  '2.2': {
    title: 'THE SWOLLEN SUGAR BAG',
    logline: 'A visking-tubing demo confuses a class until a market-soaking beans story links osmosis to water moving across a membrane.',
    setting: 'INT. lab + brief EXT. home kitchen flashback',
    characters: [
      { name: 'TONNY', line: 'learner who loves cooking metaphors', costume: 'lab apron over uniform' },
      { name: 'MS. WAMBUI', line: 'teacher guiding the demo', costume: 'lab coat' },
      { name: 'CHEBET', line: 'skeptical classmate', costume: 'uniform' },
    ],
    goal: 'Explain why the tubing gains water using osmosis, not vague “soaking”',
    wrong: 'Chebet says sugar particles push out to equalize everything like diffusion only',
    right: 'Tonny traces water movement across the selectively permeable membrane',
    reflectionQ: 'What moves in osmosis, and through what?',
    reflectionA: 'Water across a selectively permeable membrane',
  },
  '2.3': {
    title: 'THE QUIET QUESTION',
    logline: 'A learner facing painful periods gets scientific, respectful guidance instead of myths from the hallway.',
    setting: 'INT. school counselor corner / clinic waiting bench',
    characters: [
      { name: 'Amina', line: 'Grade 8 learner seeking help', costume: 'uniform, sweater' },
      { name: 'Nurse Atieno', line: 'school health nurse', costume: 'nurse tunic' },
      { name: 'Purity', line: 'well-meaning friend with myths', costume: 'uniform' },
    ],
    goal: 'Replace myths with accurate menstrual-cycle science and care steps',
    wrong: 'Purity repeats unsafe myths about “holding periods” and shame',
    right: 'Nurse Atieno explains cycle stages, hygiene, and when to see a clinician',
    reflectionQ: 'Why should learners use scientific sources for reproductive health?',
    reflectionA: 'Myths can harm; accurate terms guide safe care',
  },
  '3.1': {
    title: 'TORCH BEFORE HOMEWORK',
    logline: 'A blackout forces a family to trace energy transformations in a torch and a solar lamp to finish homework.',
    setting: 'INT. rural-urban home at dusk',
    characters: [
      { name: 'SAMUEL', line: 'Grade 8 boy racing sunset', costume: 'home clothes' },
      { name: 'GRANDPA JOEL', line: 'retired electrician, storyteller', costume: 'cardigan' },
      { name: 'NEEMA', line: 'sister managing solar lamp', costume: 'hoodie' },
    ],
    goal: 'Keep light long enough by choosing the better energy chain',
    wrong: 'Samuel leaves a weak torch on, wasting chemical energy as heat',
    right: 'They map chemical→electrical→light and switch to charged solar wisely',
    reflectionQ: 'What energy chain occurs in a simple torch?',
    reflectionA: 'Chemical → electrical → light (+ heat)',
  },
  '3.2': {
    title: 'THE SINKING HANDCART',
    logline: 'A handcart sticks in mud until the movers change contact area and rediscover pressure as force over area.',
    setting: 'EXT. muddy estate road after rain',
    characters: [
      { name: 'BARAKA', line: 'delivery helper, strong, impatient', costume: 'boots, overalls' },
      { name: 'IDRIS', line: 'physics-minded friend', costume: 'raincoat' },
      { name: 'BIBI FATUMA', line: 'customer waiting for goods', costume: 'lesso, umbrella' },
    ],
    goal: 'Free the cart without breaking goods or injuring backs',
    wrong: 'Baraka pushes harder on a narrow plank, sinking deeper',
    right: 'Idris widens the base with boards; pressure drops; cart moves',
    reflectionQ: 'How does increasing area change pressure for the same force?',
    reflectionA: 'P = F/A; larger A → smaller P',
  },
};

function scenesFor(cast) {
  // ~8 scenes for ~8–10 minutes; dialogue-heavy acted beats
  return [
    {
      heading: 'SCENE 1 — EXT./INT. OPENING LOCATION — DAY',
      action: `${cast.characters[0].name} enters the world of the story with a clear goal: ${cast.goal}. Camera follows hands and faces, not a chalkboard.`,
      dialogue: [
        [cast.characters[0].name, `If I can just get this right today, everything else will fall into place.`],
        [cast.characters[1].name, `Then stop guessing. Show me what you think is happening.`],
      ],
      camera: 'Wide establishing → medium two-shot. Ambient authentic location SFX. Soft hopeful underscore.',
    },
    {
      heading: 'SCENE 2 — SAME / NEARBY — DAY',
      action: `Obstacle appears. Stakes rise. Props related to the science idea are handled as real objects, not lecture aids.`,
      dialogue: [
        [cast.characters[0].name, `It looks simple. Watch me do it the usual way.`],
        [cast.characters[2].name, `If you are wrong, we lose time — and maybe more than time.`],
      ],
      camera: 'Close-ups on props and worried eyes. Tension riser.',
    },
    {
      heading: 'SCENE 3 — CONFRONTATION — DAY',
      action: `WRONG WAY: ${cast.wrong}. The problem worsens. Meaning stays in action and argument — characters never read notes aloud.`,
      dialogue: [
        [cast.characters[0].name, `See? I did what everyone does.`],
        [cast.characters[1].name, `And it got worse. That means your idea about it is incomplete.`],
      ],
      camera: 'Handheld urgency. Cut to the failed result.',
    },
    {
      heading: 'SCENE 4 — DISCOVERY — DAY/NIGHT',
      action: `A clue appears through action — a label, a measurement, a safer method, a remembered rule spoken as dialogue while doing.`,
      dialogue: [
        [cast.characters[1].name, `Look at what actually changed. Name it properly.`],
        [cast.characters[0].name, `Wait… if that is true, then I was measuring the wrong thing.`],
      ],
      camera: 'Insert shots of evidence. Music shifts from tension to curiosity.',
    },
    {
      heading: 'SCENE 5 — SECOND ATTEMPT — DAY',
      action: `RIGHT WAY: ${cast.right}. Characters perform the corrected action step by step.`,
      dialogue: [
        [cast.characters[0].name, `This time we follow the rule, not the rumour.`],
        [cast.characters[2].name, `I can see the difference already.`],
      ],
      camera: 'Cleaner framed shots; success micro-beats.',
    },
    {
      heading: 'SCENE 6 — COMPLICATION — DAY',
      action: `A new obstacle or time pressure forces them to apply the idea again, proving it was not luck.`,
      dialogue: [
        [cast.characters[2].name, `We are not done. Another problem just arrived.`],
        [cast.characters[1].name, `Same science. Fresh situation. Go.`],
      ],
      camera: 'Parallel cut or ticking clock motif without graphic peril.',
    },
    {
      heading: 'SCENE 7 — RESOLUTION — DAY',
      action: `Payoff: goal achieved. Characters show the result; still no voice-over lecture.`,
      dialogue: [
        [cast.characters[0].name, `It worked because we used the idea correctly — not because we pushed harder the same wrong way.`],
        [cast.characters[1].name, `Say the reason in your own words before we pack up.`],
      ],
      camera: 'Warm wider shot; relieved faces; result hero insert.',
    },
    {
      heading: 'SCENE 8 — BUTTON — DAY',
      action: `Final acted beat tying emotion to the learning without reading notes aloud.`,
      dialogue: [
        [cast.characters[2].name, `Next time someone guesses, we will ask for the reason.`],
        [cast.characters[0].name, `And we will check the evidence first.`],
      ],
      camera: 'Slow push-in; music resolves.',
    },
  ];
}

export function writeDrama(topic, studyPages) {
  const cast = CASTS[topic.topicNumber] || CASTS['1.1'];
  const scenes = scenesFor(cast);
  const lines = [];

  lines.push(titleBlock('EPISODE PACKAGE'));
  lines.push('');
  lines.push(
    `EPISODE TITLE: ${cast.title}`,
  );
  lines.push(`SUBJECT / TOPIC: INTEGRATED SCIENCE / ${topic.topicName}`);
  lines.push('GRADE: Grade 8 JSS');
  lines.push('AGE RATING: 10+ (student-safe)');
  lines.push('DURATION: 8 minutes');
  lines.push(
    'VISUAL STYLE: naturalistic live-action look with clear prop inserts (or 2D/3D cartoon adaptation of the same blocking)',
  );
  lines.push('');
  lines.push(`LEARNING TIE-IN: ${cast.goal}`);
  lines.push('');
  lines.push(`LOGLINE: ${cast.logline}`);
  lines.push('');
  lines.push(sectionBlock('WORLD & CAST'));
  lines.push(`• Setting / era: ${cast.setting}`);
  for (const c of cast.characters) {
    lines.push(`• ${c.name}: ${c.line}. Costume: ${c.costume}.`);
  }
  lines.push('');
  lines.push(sectionBlock('SCREENPLAY'));
  lines.push('');

  scenes.forEach((sc, idx) => {
    lines.push(sc.heading);
    lines.push('----');
    lines.push(`ACTION: ${sc.action}`);
    lines.push('');
    for (const [who, what] of sc.dialogue) {
      lines.push(who);
      lines.push(what);
      lines.push('');
    }
    lines.push(`CAMERA / SFX / MUSIC: ${sc.camera}`);
    lines.push('');
    // Expand dialogue volume toward 8 min honestly with a second exchange on even scenes
    if (idx % 2 === 1) {
      lines.push(cast.characters[0].name);
      lines.push(`If we ignore the detail, we will repeat the same mistake under pressure.`);
      lines.push('');
      lines.push(cast.characters[1].name);
      lines.push(`Then name the detail out loud while you do the action — teaching by doing, not by speech notes.`);
      lines.push('');
    }
  });

  lines.push(sectionBlock('BOOKENDS'));
  lines.push(`• COLD OPEN (max 10s): Quick hook image of the failed first attempt — then cut to title ${cast.title}.`);
  lines.push(
    `• CLOSING REFLECTION CARD (max 10s): On-screen question — ${cast.reflectionQ} Answer must match lesson solutions (${cast.reflectionA}).`,
  );
  lines.push('');
  lines.push(sectionBlock('CAPTIONS'));
  for (const sc of scenes) {
    for (const [who, what] of sc.dialogue) {
      lines.push(`${who}: ${what}`);
    }
  }
  lines.push('');
  lines.push(sectionBlock('ASSET LIST'));
  lines.push(`• Characters: ${cast.characters.map((c) => c.name).join(', ')}`);
  lines.push(`• Costumes: as listed above`);
  lines.push(`• Locations: ${cast.setting}`);
  lines.push(`• Props: topic-authentic objects for ${topic.topicName}`);
  lines.push(`• Key shots: failed attempt insert, evidence insert, successful payoff insert`);
  lines.push('');
  lines.push(`Study pages available for fidelity: ${studyPages.length}`);
  lines.push('DRAMA NOTE: No voice-over of lesson notes. Meaning travels through action and in-character dialogue.');

  return toUnicodeFormula(lines.join('\n'));
}
