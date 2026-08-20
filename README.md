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

Docs: http://localhost:3000/docs (PP1 and PP2 first; use the **`main`** branch)  
Learn: http://localhost:3000/learn  
Account + M-Pesa: http://localhost:3000/account and http://localhost:3000/pricing

## Content strategy (Strategy 2)

We do **not** re-upload commercial CBC pupil books or pirate PDFs.

1. Use free official **KICD Curriculum Designs** as the source of educational facts.
2. Generate **original** learner notes, quizzes, and exam papers from those outcomes.
3. Populate Revision Hub with original general / termly / mock / premium papers (and topical quizzes linked from Learn).

Optional: add freely published KNEC/SBA past papers from open education sites later — still never pirate commercial textbooks.

## Accounts and M-Pesa

Parents create an account at `/account`, then pay from `/pricing` with Safaricom Daraja STK Push. User, session, and payment rows live in Cloudflare D1 (`hightech-cbc-learners-db`) on the Worker, or in local SQLite (`web/.data/accounts.sqlite`) during `npm run dev`. Lesson JSON is **not** stored in D1.

Monthly and termly plans unlock study pages after the free preview (first 3 pages).

Live STK Push needs these Worker secrets (sandbox or production Daraja credentials):

```bash
cd web
npx wrangler secret put MPESA_CONSUMER_KEY
npx wrangler secret put MPESA_CONSUMER_SECRET
npx wrangler secret put MPESA_SHORTCODE
npx wrangler secret put MPESA_PASSKEY
```

Without those secrets, signup/login still work; Pay with M-Pesa returns a clear “not configured” error instead of charging.

## Deploy (automatic after merge)

Merging to **`main`** deploys https://hightech-cbc-learners.mikeal-murphy.workers.dev via GitHub Actions. You do **not** run `npm run deploy` on your PC after that.

One-time GitHub setup:

1. Cloudflare dashboard → **My Profile** → **API Tokens** → **Create Token**.
2. Use the **Edit Cloudflare Workers** template, and add **D1 Edit**.
3. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: the token you just created

Optional: you can also set `CLOUDFLARE_ACCOUNT_ID` (`ab8d5683744420960441889a244ac506`). It is already in `web/wrangler.jsonc`.

After the secret is set, merge this branch to `main` (or run the **Deploy HighTech CBC Learners** workflow by hand). Watch it at https://github.com/Murphy601/General/actions

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
| `npm run deploy` | Manual Worker deploy (CI does this on merge to `main`) |
| `npm test` | Account, M-Pesa, and phone helper tests |

Revision Hub: http://localhost:3000/revision  
Past Paper Vault: http://localhost:3000/revision/vault  
