/**
 * Universal Screen-Drama — acted episode for any CBC topic (no recurring cast).
 */
import { titleBlock, sectionBlock } from './house-style.mjs';

const NAMES = [
  ['Amani', 'Wanjiku', 'Otieno'],
  ['Neema', 'Baraka', 'Halima'],
  ['Kevo', 'Lulu', 'Mama Rose'],
  ['Faith', 'Brian', 'Mr Kamau'],
  ['Nzuri', 'Idris', 'Auntie Fatuma'],
  ['Chebet', 'Tonny', 'Ms Achieng'],
  ['Samuel', 'Neema', 'Grandpa Joel'],
  ['Purity', 'Owino', 'Nurse Atieno'],
];

function hash(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0;
  return h;
}

function castFor(topic) {
  const seed = hash(`${topic.grade}|${topic.subject}|${topic.topicNumber}|${topic.topicName}`);
  const names = NAMES[seed % NAMES.length];
  const idea = topic.topicName || 'the lesson idea';
  return {
    title: `THE DAY WE GOT ${String(idea).toUpperCase().slice(0, 28)} RIGHT`,
    logline: `Learners nearly fail a real task linked to ${idea} until they stop guessing and use the correct method.`,
    setting: 'INT./EXT. Kenyan home, school, or market — present day',
    characters: [
      { name: names[0].toUpperCase(), line: 'curious learner who jumps to conclusions', costume: 'school or home clothes' },
      { name: names[1].toUpperCase(), line: 'careful friend who checks evidence', costume: 'everyday clothes' },
      { name: names[2].toUpperCase(), line: 'adult guide who asks for reasons, not slogans', costume: 'apron / lab coat / lesso' },
    ],
    goal: `Complete a practical task correctly using ${idea}`,
    wrong: `Guessing or copying a rumour about ${idea}`,
    right: `Naming the idea correctly and applying a clear step-by-step check`,
    reflectionQ: `What evidence shows you understood ${idea}?`,
    reflectionA: 'A correct definition + one local example + one corrected mistake',
  };
}

function scenesFor(cast) {
  return [
    {
      heading: 'SCENE 1 — OPENING — DAY',
      action: `${cast.characters[0].name} enters with a clear goal: ${cast.goal}. Camera follows hands and faces.`,
      dialogue: [
        [cast.characters[0].name, `If I finish this today, I will finally understand it.`],
        [cast.characters[1].name, `Then stop guessing. Show me your first step.`],
      ],
    },
    {
      heading: 'SCENE 2 — OBSTACLE — DAY',
      action: `A real-world obstacle appears. Props related to the topic are handled as real objects.`,
      dialogue: [
        [cast.characters[0].name, `It looks easy. Watch me do it the usual way.`],
        [cast.characters[2].name, `If you are wrong, we lose time — and maybe more.`],
      ],
    },
    {
      heading: 'SCENE 3 — WRONG WAY — DAY',
      action: `WRONG WAY: ${cast.wrong}. The problem worsens. Meaning stays in action — no reading notes aloud.`,
      dialogue: [
        [cast.characters[0].name, `See? That is what everyone says.`],
        [cast.characters[1].name, `And it got worse. Your idea is incomplete.`],
      ],
    },
    {
      heading: 'SCENE 4 — DISCOVERY — DAY',
      action: `A clue appears through action — a label, a count, a safer method, a remembered rule spoken while doing.`,
      dialogue: [
        [cast.characters[1].name, `Look at what actually changed. Name it properly.`],
        [cast.characters[0].name, `Wait… if that is true, I was checking the wrong thing.`],
      ],
    },
    {
      heading: 'SCENE 5 — RIGHT WAY — DAY',
      action: `RIGHT WAY: ${cast.right}. Characters perform the corrected action step by step.`,
      dialogue: [
        [cast.characters[0].name, `This time we follow the rule, not the rumour.`],
        [cast.characters[2].name, `I can see the difference already.`],
      ],
    },
    {
      heading: 'SCENE 6 — SECOND TEST — DAY',
      action: `A new obstacle forces them to apply the idea again, proving it was not luck.`,
      dialogue: [
        [cast.characters[2].name, `We are not done. Another problem just arrived.`],
        [cast.characters[1].name, `Same idea. Fresh situation. Go.`],
      ],
    },
    {
      heading: 'SCENE 7 — RESOLUTION — DAY',
      action: `Payoff: goal achieved. Characters show the result without a lecture voice-over.`,
      dialogue: [
        [cast.characters[0].name, `It worked because we used the idea correctly.`],
        [cast.characters[1].name, `Say the reason in your own words before we pack up.`],
      ],
    },
    {
      heading: 'SCENE 8 — BUTTON — DAY',
      action: `Final acted beat tying emotion to learning.`,
      dialogue: [
        [cast.characters[2].name, `Next time someone guesses, we will ask for the reason.`],
        [cast.characters[0].name, `And we will check the evidence first.`],
      ],
    },
  ];
}

export function writeUniversalDrama(topic, studyPages) {
  const cast = castFor(topic);
  const scenes = scenesFor(cast);
  const lines = [
    titleBlock('EPISODE PACKAGE'),
    '',
    `EPISODE TITLE: ${cast.title}`,
    `SUBJECT / TOPIC: ${topic.subject} / ${topic.topicName}`,
    `GRADE: ${topic.gradeLabel || topic.grade}`,
    `LENGTH TARGET: 5–10 minutes`,
    `LOGLINE: ${cast.logline}`,
    `SETTING: ${cast.setting}`,
    '',
    sectionBlock('CAST'),
    ...cast.characters.map((c) => `• ${c.name} — ${c.line} (${c.costume})`),
    '',
    sectionBlock('STORY GOAL'),
    cast.goal,
    '',
    sectionBlock('WRONG WAY vs RIGHT WAY'),
    `Wrong: ${cast.wrong}`,
    `Right: ${cast.right}`,
    '',
    sectionBlock('SCENES'),
  ];

  scenes.forEach((sc) => {
    lines.push('');
    lines.push(sc.heading);
    lines.push(sc.action);
    sc.dialogue.forEach(([who, line]) => lines.push(`${who}: "${line}"`));
  });

  lines.push('');
  lines.push(sectionBlock('REFLECTION BEAT (ON SCREEN, ACTED)'));
  lines.push(`${cast.characters[1].name}: "${cast.reflectionQ}"`);
  lines.push(`${cast.characters[0].name}: "${cast.reflectionA}"`);
  lines.push('');
  lines.push(
    `Study pages covered: ${(studyPages || []).length} pages on ${topic.topicName}.`,
  );

  return lines.join('\n');
}
