# Commands to run (Windows) — READ THIS

Your old lessons (INTRODUCTION + SECTION 7 KICD dump) are **local stale files**.
You must overwrite them with the branch content, then restart the site.

## A) Force-update (do this first)

```powershell
cd C:\Users\user\General

# Stop the running site (Ctrl+C in the terminal that has npm run dev)

git fetch origin
git checkout cursor/cbc-learning-website-0ec7
git reset --hard origin/cursor/cbc-learning-website-0ec7

# Clear Next.js cache so it cannot serve old pages
npm run web:clean

npm run curriculum:prepare
cd web
npm run dev
```

Then open (hard refresh: Ctrl+F5):

- http://localhost:3000/learn/grade-4/mathematics/1-4-multiplication-8
- You should see **SECTION 3: STUDY NOTES** with worked examples like `24 × 10 = 240`

If you still see **SECTION 7: KICD CURRICULUM REFERENCE**, the old files were not overwritten — run the `git reset --hard` block again.

## B) Optional: regenerate lessons on your PC

Only needed if you want to rebuild from scratch:

```powershell
cd C:\Users\user\General
npm run content:generate -- --grade grade-4 --subject "MATHEMATICS" --no-llm --delay 0 --reset
npm run content:generate-exams:all
npm run content:ingest-past-papers
```

## C) Useful URLs

- Learn: http://localhost:3000/learn
- Revision Hub: http://localhost:3000/revision
- Past Paper Vault: http://localhost:3000/revision/vault
