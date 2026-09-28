# Grade 4 — curriculum-grounded lessons

Every Grade 4 class on the site is built from the official **KICD Grade 4 Curriculum Designs (First Published 2017, Revised 2024)**.
Nothing is generated from templates. Each lesson is tied to the design's specific learning outcomes, and the build refuses content that fails validation.

```
designs/<slug>.txt                 Official design text (from phase3/curriculum-text.json.gz) — the source of truth
designs/manifest.json              Design ids, KICD source URL, page counts
syllabus/<slug>/<n>-<strand>.json  Strands → sub-strands, copied word-for-word from the design (validated against designs/).
                                   One file per strand or group of strands; all parts are merged in strand order.
lessons/<slug>/<number>.json       One lesson pack per sub-strand (validated against syllabus/), e.g. 1.1.json or 1.4.2.json
```

Supporting KICD material: `knowledge-base/textbooks/text/grade-4/<subject>/*.json` holds transcripts of KICD Grade 4 radio lessons.

Commands (repo root):

```bash
node scripts/grade4/extract-designs.mjs          # refresh designs/*.txt
node scripts/grade4/validate.mjs [slug]          # check syllabus + lessons
node scripts/grade4/build.mjs                    # publish to web/data/content + curriculum index
```

## syllabus/<slug>.json

```jsonc
{
  "subject": "MATHEMATICS",            // must match scripts/grade4/subjects.mjs
  "slug": "mathematics",
  "totalLessons": 150,                 // from the design's summary table
  "strands": [
    {
      "number": "1.0",
      "name": "Numbers",               // English themes: e.g. "The Family"; Kiswahili: "Mandhari" names as printed
      "subStrands": [
        {
          "number": "1.1",
          "name": "Whole Numbers",     // as printed in the summary table / sub-strand column
          "lessons": 10,               // suggested number of lessons
          "content": ["Place value and total value"],           // bullet points listed under the sub-strand (if any)
          "outcomes": [{ "id": "a", "text": "use place value and total value of digits up to tens of thousands in daily life situations" }],
          "learningExperiences": ["share tasks in identifying place value of numbers up to tens of thousands using place value apparatus and other resources"],
          "keyInquiryQuestions": ["What should you consider when writing numbers in words?"],
          "coreCompetencies": ["Critical thinking and problem solving: learner uses place value apparatus to identify place value of numbers up to tens of thousands."],
          "values": ["Respect: learner takes turn to represent Hindu Arabic numerals using Roman numerals up to ‘X’ using number charts."],
          "pcis": ["Social Cohesion: learner works harmoniously with others in identifying factors/divisors of numbers up to 50."],
          "links": ["The learner is able to relate rounding off numbers up to 1,000 to the nearest ten to rounding off distances on a map in Social Studies."]
        }
      ]
    }
  ]
}
```

Rules:

- **Copy text exactly as printed** (keep KICD spelling). Drop only bullet symbols, the leading `a)` letter and the trailing `,` / `.` / `;`.
  The validator compares letters and digits only, so spacing and line breaks from the PDF do not matter, but changed or invented words fail.
- A sentence cut by a page break or by the neighbouring table column is still copied as one string; the validator accepts up to 3 fragments in order.
- In English and Kiswahili the "strand" is the theme (1.0 The Family) and the sub-strands are 1.1 Listening and Speaking, 1.2 Reading, etc.
  Put the skill focus in the name, e.g. `"Listening and Speaking: Pronunciation and Vocabulary"`.

## lessons/<slug>/<n.n>.json

```jsonc
{
  "subject": "MATHEMATICS",
  "subStrand": "1.1",
  "title": "Whole Numbers",            // must equal the syllabus name
  "overview": "2–4 sentences telling the learner what this sub-strand is about.",
  "lessons": [
    {
      "number": 1,
      "title": "Place value up to tens of thousands",
      "outcomes": ["a"],               // syllabus outcome ids this lesson teaches
      "objectives": ["Name the place value of each digit in a 5-digit number."],
      "intro": "Short, concrete opening that connects to the learner's life.",
      "notes": "The teaching. Paragraphs separated by blank lines. Use '- ' bullets and '### ' sub-headings.",
      "keyWords": [{ "word": "place value", "meaning": "the position of a digit in a number" }],
      "examples": [
        { "problem": "Find the total value of 7 in 47,315.", "steps": ["7 is in the thousands place.", "7 × 1,000 = 7,000"], "answer": "7,000", "check": "7*1000 === 7000" }
      ],
      "activity": { "title": "Place value chart", "materials": ["number cards"], "steps": ["..."] },
      "diagram": { "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 400 120\">…</svg>", "caption": "Place value chart" },
      "practice": [{ "question": "Write the place value of 4 in 24,618.", "answer": "Thousands", "check": null }],
      "summary": ["The place of a digit tells its value."]
    }
  ],
  "quiz": [
    {
      "question": "What is the total value of 3 in 13,452?",
      "options": ["30", "300", "3,000", "30,000"],
      "answer": "C",                   // letter for multiple choice, otherwise the full answer text
      "explanation": "3 is in the thousands place: 3 × 1,000 = 3,000.",
      "outcome": "a",
      "check": "3*1000 === 3000"
    }
  ],
  "sources": ["KICD Grade 4 Mathematics Curriculum Design (Revised 2024) — Strand 1.0 Numbers, Sub-strand 1.1 Whole Numbers"]
}
```

Rules:

- Every syllabus outcome of the sub-strand appears in at least one lesson's `outcomes`.
- Teach only what the outcomes ask for, at Grade 4 level (age 9–10). No facts you are not sure of: no invented statistics,
  county-specific claims, dates, names or scripture references that are not in the design or widely established.
- Activities follow the design's suggested learning experiences.
- `check` is an arithmetic expression that must evaluate to `true` (digits, `+ - * / % ( ) . , < > = ! & |`, spaces and `Math.round|floor|ceil|abs|min|max` only).
  Mathematics packs need a `check` on at least half of all examples, practice items and quiz items.
- `diagram.svg` is optional; it must be a self-contained `<svg>` with no scripts, event handlers or external links.
- Kiswahili packs are written entirely in Kiswahili; other language packs in the language being taught, with English help where the design allows.
