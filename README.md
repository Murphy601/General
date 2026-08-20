# HighTech CBC Learners

Kenyan CBC learning platform (**PP1 → PP2 → Grade 1–12**, then subject and topic) with lessons, quizzes, and answers.

**Live site:** https://hightech-cbc-learners.mikeal-murphy.workers.dev

Always use the **`main`** branch. Do not pull the old `cursor/cbc-learning-website-0ec7` branch.

## Quick start (Windows)

See **[WINDOWS.md](./WINDOWS.md)** and **[COMMANDS.md](./COMMANDS.md)** for the full command list.

```powershell
cd C:\Users\user\General
git checkout main
git pull origin main
npm run curriculum:prepare
npm run web:clean
cd web
npm run dev
```

## Quick start (macOS / Linux)

```bash
git checkout main
git pull origin main
npm run curriculum:prepare
cd web && npm run dev
```

Open http://localhost:3000 — the home page lists **Pre-Primary (PP1, PP2)** first, then Grade 1–12.

Learn: http://localhost:3000/learn  
Account + M-Pesa: http://localhost:3000/account and http://localhost:3000/pricing

## Content strategy (Strategy 2)

We do **not** re-upload commercial CBC pupil books or pirate PDFs.

1. Use free official **KICD Curriculum Designs** as the source of educational facts.
2. Generate **original** learner notes, quizzes, and exam papers from those outcomes.
3. Populate Revision Hub with original general / termly / mock / premium papers (and topical quizzes linked from Learn).

Optional: add freely published KNEC/SBA past papers from open education sites later — still never pirate commercial textbooks.

## Accounts and M-Pesa

Parents create an account at `/account`, then pay from `/pricing` with Safaricom Daraja STK Push. User, session, and payment rows live in Cloudflare D1 (`hightech-cbc-learners-db`). Lesson JSON is **not** stored in D1.

Live STK Push needs these Worker secrets (sandbox or production Daraja credentials):

```bash
cd web
npx wrangler secret put MPESA_CONSUMER_KEY
npx wrangler secret put MPESA_CONSUMER_SECRET
npx wrangler secret put MPESA_SHORTCODE
npx wrangler secret put MPESA_PASSKEY
```

Without those secrets, signup/login still work; Pay with M-Pesa returns a clear “not configured” error instead of charging.

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
| `npm run deploy` | Pack lesson assets and deploy the Worker |

Revision Hub: http://localhost:3000/revision  
Past Paper Vault: http://localhost:3000/revision/vault  
