# CBC Learn

Kenyan CBC learning platform (Grade → Subject → Topic) with lessons, quizzes, and answers.

## Quick start (Windows)

See **[WINDOWS.md](./WINDOWS.md)** and **[COMMANDS.md](./COMMANDS.md)** for the full command list.

```powershell
cd C:\Users\user\General
git pull origin cursor/cbc-learning-website-0ec7
npm run curriculum:prepare
npm run web:clean
cd web
npm run dev
```

## Quick start (macOS / Linux)

```bash
git pull origin cursor/cbc-learning-website-0ec7
npm run curriculum:prepare
cd web && npm run dev
```

Open http://localhost:3000/learn

## Content strategy (Strategy 2)

We do **not** re-upload commercial CBC pupil books or pirate PDFs.

1. Use free official **KICD Curriculum Designs** as the source of educational facts.
2. Generate **original** learner notes, quizzes, and exam papers from those outcomes.
3. Populate Revision Hub with original general / termly / mock / premium papers (and topical quizzes linked from Learn).

Optional: add freely published KNEC/SBA past papers from open education sites later — still never pirate commercial textbooks.

## Useful scripts

| Script | Purpose |
|--------|---------|
| `npm run curriculum:prepare` | Decompress `curriculum-text.json.gz` if missing/stale |
| `npm run content:ingest-early` | Ingest PP1/PP2/G1–3 from local PDFs (`pdftotext` required) |
| `npm run content:index` | Rebuild grade → subject → topic index |
| `npm run content:generate -- --grade grade-3 --subject "ENGLISH" --no-llm --delay 0 --reset` | Rebuild original learner lessons for a grade/subject |
| `npm run content:generate -- --all --no-llm --delay 0 --reset` | Rebuild all learner lessons (Strategy 2) |
| `npm run content:generate-exams:all` | Fill Revision Hub (general, termly, mock, premium) |
| `npm run content:generate-exams -- --grade grade-4` | Exams for one grade |
| `npm run content:ingest-past-papers` | Fill **Past Paper Vault** (free KPSEA links from Shulefiti) |
| `npm run web:clean` | Delete `web/.next` (fixes Windows file locks) |
| `npm run web:dev` | Install, build catalog, start Next.js |

Revision Hub: http://localhost:3000/revision  
Past Paper Vault: http://localhost:3000/revision/vault  
