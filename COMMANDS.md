# Commands to run (Windows + Mac/Linux)

Pull the latest branch first, then run these from the **repo root** (`General`).

## 1) Update code and unlock Windows files

```powershell
cd C:\Users\user\General
git fetch origin
git checkout cursor/cbc-learning-website-0ec7
git pull origin cursor/cbc-learning-website-0ec7

# If git pull complains about index.json:
git restore web/data/content/index.json

# If .next is locked:
npm run web:clean
```

## 2) Prepare curriculum text

```powershell
npm run curriculum:prepare
```

## 3) Rebuild learner lessons (fixes Word Reading / curriculum dumps)

This rewrites lessons as original learner notes from KICD outcomes (Strategy 2):

```powershell
# One grade + subject (example: Grade 3 English)
npm run content:generate -- --grade grade-3 --subject "ENGLISH" --no-llm --delay 0 --reset

# All PP1–Grade 9 (takes several minutes)
npm run content:generate -- --grade pp1 --no-llm --delay 0 --reset
npm run content:generate -- --grade pp2 --no-llm --delay 0 --reset
npm run content:generate -- --grade grade-1 --no-llm --delay 0 --reset
npm run content:generate -- --grade grade-2 --no-llm --delay 0 --reset
npm run content:generate -- --grade grade-3 --no-llm --delay 0 --reset
npm run content:generate -- --grade grade-4 --no-llm --delay 0 --reset
npm run content:generate -- --grade grade-5 --no-llm --delay 0 --reset
npm run content:generate -- --grade grade-6 --no-llm --delay 0 --reset
npm run content:generate -- --grade grade-7 --no-llm --delay 0 --reset
npm run content:generate -- --grade grade-8 --no-llm --delay 0 --reset
npm run content:generate -- --grade grade-9 --no-llm --delay 0 --reset
```

## 4) Fill Revision Hub exams (original papers)

```powershell
npm run content:generate-exams:all
```

## 5) Fill Past Paper Vault (free KPSEA links from Shulefiti)

```powershell
npm run content:ingest-past-papers
```

## 6) Start the site

```powershell
cd web
npm run dev
```

Open:

- Learn: http://localhost:3000/learn
- Grade 3 Word Reading: http://localhost:3000/learn/grade-3/english-activities/2-2-word-reading
- Revision Hub: http://localhost:3000/revision
- Past Paper Vault: http://localhost:3000/revision/vault

## Notes

- Prefer **pulling this branch** — lessons and vault papers are already generated in the repo.
- Do **not** hunt pirate textbook PDFs. Lessons/exams are original from KICD designs; vault papers are free open-catalog KPSEA links.
