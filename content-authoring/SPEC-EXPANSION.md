# Grade 4 expansion pass: MORE PAGES, MORE VARIETY (read after SPEC.md)

The first pass produced valid lessons of only 5–9 pages. The product owner says that is too few and too samey.
**Expand every lesson you own to 12–18 pages of genuinely different content** (validator: min 12, max 20 pages).
Edit the existing lesson file **in place** (same filename, same `topicNumber`/`topicName`). Keep what is good, fix
what is weak, add new pages. Do not just pad or split existing text: every added page must teach or practise something new.

## Page kinds (mandatory tag on every page header)
`## PAGE 4: Title | kind` — kind is one of:
`hook` (curiosity opener, riddle, short scenario), `concept` (core teaching), `example` (worked/modelled example),
`practice` (guided exercises with answers hints in text), `activity` (hands-on task using local materials or a game),
`story` (short original story/dialogue that carries the idea), `real-life` (applications in Kenyan daily life/work),
`mistakes` (common errors and how to fix them), `vocabulary` (key words with meanings/examples),
`fact` ("Did you know?" verified facts only), `project` (mini project or investigation, with steps),
`review` (self-check/recap before the quiz), `summary` (final summary + what comes next).
Rules enforced by the validator: every lesson has `practice`, `mistakes`, `real-life`, `summary`, and `activity` or `project`;
**at least 7 different kinds** per lesson; no duplicate page titles; the kind tag is stripped for display.
Suggested flow (adapt to the topic, do not follow it mechanically): hook → concept (several pages, one idea each) →
example(s) → practice → activity/story → vocabulary → mistakes → real-life → fact → project → review → summary.

## Diversity requirements
- Different topics must NOT reuse the same page skeleton, opening sentences or example scenarios. Vary contexts (market,
  shamba, school trip, football, matatu, kitchen, river, village, town…), characters (use varied Kenyan names) and formats
  (dialogue, table-like lists, step-by-step procedure, riddle, song/rhyme, interview, diary entry, letter, poster text).
- Include more figures where a picture helps (SVG rules from SPEC.md). Visual subjects: ≥ 4 figures per lesson where sensible.
- No paragraph may be copied between lessons (validator checks). No filler; each page 150–350 words.
- Difficulty ramps up across the pages; keep Grade 4 level; facts you are unsure of stay out (list in NOTES).
- Language subjects: keep the target-language rules from SPEC.md; more pages means more vocabulary sets, dialogues, reading
  texts, writing frames, pronunciation drills and games, not English padding.

## Quiz
Extend each lesson's `## QUIZ` to **10–14 items** (≥ 5 MCQ, ≥ 3 written), covering the new pages too. Keep existing good
items; every item still needs `Answer:` and `Why:`.

## Scope and safety
- Only edit the lesson files assigned to you (use `node scripts/g4/list-half.mjs <slug> <A|B|all>`); do not touch other
  files, `bank/`, `manifest.json`, `web/`, or scripts. Another agent may be editing the other half of the same subject.
- Validate: `node scripts/g4/validate.mjs <slug>` — ignore problems in files that are not yours; your files must have none.
- When done, append a short "Expansion pass" section to your subject's `NOTES.md` only if you have new facts for a human to
  check (append, don't rewrite; use a single append so you don't clobber the other agent).
- Final message ≤ 120 words: lessons expanded, total pages now, anything to verify.
