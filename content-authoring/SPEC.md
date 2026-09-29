# Grade 4 content authoring spec (READ FULLY)

You are one of several agents rewriting the **Grade 4** learning content for a Kenyan CBC platform. The previous
content was auto-generated filler (pasted curriculum-outcome fragments, the same "define X in your own words" quiz,
joke distractors, irrelevant worked examples). **Replace it with real teaching that a Grade 4 child (age 9–10) can learn
from, and that a teacher would be happy to put their name to.**

## Ground rules
1. **Accuracy over volume.** Only state facts you are certain of. If unsure, leave it out or teach a safer, correct
   version. Never invent names, dates, verses, statistics, foreign-language words, hadith/verse references or
   pronunciations. Anything doubtful goes in `NOTES.md` in your subject folder (a short list) so a human can check it.
2. **Teach the syllabus.** Your folder has `curriculum-source.txt` (OCR text of the official KICD Grade 4 curriculum
   design for your subject: strands, sub-strands, specific learning outcomes, suggested learning experiences, key
   inquiry questions). Read it first (use Grep/Read with offsets; it is large). Every lesson must cover the specific
   learning outcomes of its sub-strand at Grade 4 level. The OCR is noisy — use your own knowledge to reconstruct meaning.
3. **Grade-appropriate.** Short sentences, concrete examples, Kenyan everyday context when it is natural (Ksh,
   matatu, shamba, market, county, local foods) — never forced. Vocabulary a 9–10 year old can read. No content from
   higher grades (e.g. no algebra, square roots, GCD, perimeter formulas in symbols unless the Grade 4 design has them).
4. **Real lessons, not dumps.** No template sentences repeated between lessons, no pasted outcome fragments, no
   "Say what X means in plain words" scaffolding, no filler like "Careful checking comes first". Each page must teach
   something specific to its topic. Vary the structure of examples between topics.
5. **Work only inside your own folder** `content-authoring/grade-4/<your-subject-slug>/`. Never edit anything under
   `web/`, `scripts/`, `knowledge-base/`, `manifest.json`, or other subjects' folders. Do not run `scripts/g4/build.mjs`.
   Do not git commit or push. Do not spawn further agents.

## What to produce in your folder
```
lessons/<topicNumber>-<slug>.md   one file per sub-strand/topic
bank/bank-01.json, bank-02.json…  exam question bank (see below)
retire.json                       optional: ["1.3", ...] manifest topicNumbers that are OCR noise, not real topics
NOTES.md                          uncertainties / gaps / decisions (short)
```
Look at `manifest.json`: it lists the topics the old build knew (noisy, incomplete, names often truncated like
"Whole Numbers (10"). Cover **every real sub-strand in the curriculum design**, using the design's own numbering as
`topicNumber` (e.g. `2.3`), unique within the subject. Topics missing from the manifest must still get lessons.
Every manifest `topicNumber` must either have a lesson or be listed in `retire.json`.

## Lesson file format (see `content-authoring/EXAMPLE-lesson.md` for a complete, valid example)
```
---
topicNumber: 3.3
topicName: Plane Figures
strand: Geometry
---
## PAGE 1: <specific page title>
plain text …
## PAGE 2: …
…
## QUIZ
1. question …
   A) …            (MCQ has exactly 4 options A–D)
   B) …
   C) …
   D) …
   Answer: B
   Why: explanation / full working
2. written question (3 marks)      (no options = written item; put marks in "(n marks)")
   Answer: model answer
   Why: marking points / working
```
- **5–9 pages per lesson, 150–350 words each** (validator enforces ≥120 words/page, ≥5 pages). A page = one learning step:
  e.g. hook/idea → core concept with examples → second concept → worked example(s) → practice/activity → summary + common
  mistakes. Depth should match how many outcomes the sub-strand has.
- **Plain text only** (the app shows text as-is). Sub-headings: `### Heading`. Bullets: `• `. Numbered steps: `1. `. No
  bold/italics markers, no markdown tables (use short aligned lines), no HTML except inside a figure.
- **Quiz per lesson: 8–10 items**, at least 4 MCQ and 3 written. Different question types and cognitive levels (recall,
  apply, explain, calculate/draw/compose). Questions must be answerable from what the lesson taught. MCQ: one clearly
  correct option, plausible distractors, no duplicate options, no "all of the above". `Answer:` for MCQ starts with the
  letter. `Why:` is mandatory for every item: for maths/science calculations show every step and units.
  Never write "define X in your own words" style filler.
- **Figures** — `:::figure … :::` blocks anywhere inside a page:
```
:::figure
caption: Figure 1: <what it shows>
alt: <one-sentence description for screen readers>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200" role="img"> … </svg>
:::
```
  Use figures wherever a picture teaches better than words: shapes, number lines, fraction bars, angles, clocks,
  measuring, data charts (Maths); states of matter, light/shadow, heat, water cycle, plant/animal parts (Science);
  crop/seed/stitch/tool diagrams (Agriculture); compass rose, sketch maps, physical features (Social Studies);
  instruments, notation, colour wheel, patterns (Creative Arts); labelled vocabulary scenes, sentence-structure
  diagrams, letter/character stroke tables, tone contours (languages); timelines or simple scenes for RE where useful.
  Visual subjects (Maths, Science & Technology, Agriculture, Social Studies, Creative Arts): **at least 1 figure in every
  lesson, usually 2–3**. Other subjects: a figure whenever it genuinely helps (roughly one lesson in three or more).
  SVG rules: inline only (no external images, fonts, scripts, links); valid XML; `viewBox` required; fits ≤ 420px wide;
  font-size ≥ 12; high-contrast fills on white; every label spelled correctly; **drawings must be true to the numbers**
  (a 6 cm × 3 cm rectangle must be drawn 2:1; angle diagrams must show the stated angle; clocks must show the stated time;
  bar charts must match the data). Keep each SVG simple and clean (≤ ~40 elements). Re-read each SVG for correctness.
  Emoji are not allowed in figures. Do not embed copyrighted characters/logos.

## Exam question bank (`bank/*.json`, several files of ≤ ~100 items each)
The build script assembles 80 different papers (general 30 marks, termly 50, mock 80, premium 100) from your bank, so the
bank must be **broad, varied, correct and self-contained**.
```json
{ "mcq":   [ { "topic": "3.3", "q": "…", "options": ["…","…","…","…"], "answer": 2, "explanation": "…" } ],
  "short": [ { "topic": "3.3", "q": "…", "marks": 3, "answer": "model answer", "working": "mark allocation / steps" } ] }
```
- **≥ 400 MCQ and ≥ 160 short-answer items in total** (more is better), spread across ALL your topics roughly in
  proportion to how much syllabus each covers. `topic` = a lesson `topicNumber` string that exists.
- `answer` is the 0-based index of the correct option. Vary the correct position. Exactly one correct option; four distinct options.
- Short items: `marks` is an integer 2–5; include a healthy mix (≥ 35 items of 2 marks, ≥ 35 of 3 marks, plenty of 4 and 5).
  `answer` = full model answer; `working` = how the marks are earned (or the calculation steps).
- Mix difficulty (≈ 40% recall, 40% apply, 20% higher-order). No question may depend on a picture that isn't in the
  text: describe any figure in words. No duplicate questions. No trick/joke options. No questions above Grade 4 level.
- Questions in the language of the subject where appropriate (Kiswahili in Kiswahili, etc.).

## Validate — mandatory
Run `node scripts/g4/validate.mjs <your-subject-slug>` from the repo root and fix every problem until it prints `OK`.
The validator checks structure, word counts, SVG balance, banned filler phrases, MCQ integrity, bank size and duplicates.
It cannot judge correctness — that is on you: re-read your worked examples, answers and figures.

## Working method
Write one lesson file at a time with the Write tool, checking each against the curriculum outcomes. Write the bank in
multiple files. Do not stop until `validate` says OK and every real topic has a lesson. Final message to the lead:
≤ 150 words — topics covered, figure count, bank size, anything a human must double-check.
