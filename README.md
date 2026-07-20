# CBC Learn

Kenyan CBC learning platform (Grade → Subject → Topic) with lessons, quizzes, and answers.

## Quick start (Windows)

See **[WINDOWS.md](./WINDOWS.md)** for PowerShell steps (pull, unlock `.next`, start the site).

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

## Useful scripts

| Script | Purpose |
|--------|---------|
| `npm run curriculum:prepare` | Decompress `curriculum-text.json.gz` if missing/stale |
| `npm run content:ingest-early` | Ingest PP1/PP2/G1–3 from local PDFs (`pdftotext` required) |
| `npm run content:index` | Rebuild grade → subject → topic index |
| `npm run content:generate -- --grade pp1 --no-llm --delay 0` | Generate lessons for a grade |
| `npm run web:clean` | Delete `web/.next` (fixes Windows file locks) |
| `npm run web:dev` | Install, build catalog, start Next.js |
