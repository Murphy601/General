# Windows — get multi-page Grade 8 Integrated Science

## You are on OLD content if you see this

```
SECTION 1: WELCOME
SECTION 2: WHAT YOU WILL LEARN
— CBC Learn · Classroom study notes (Strategy 2)
```

That is the **old single-page template**. Multi-page lessons show:

- Tab **Study Pages** (not only “Lesson”)
- Green banner: **Multi-page study · N pages**
- Page chips: Page 1, Page 2, Page 3, 🔒 4…
- Page 4+ → **Page locked** paywall card

## Force update (fetch often fails on Windows)

```powershell
cd C:\Users\user\General
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

git config --global http.postBuffer 524288000
git config --global http.version HTTP/1.1
git fetch --depth 1 origin cursor/cbc-learning-website-0ec7
git reset --hard FETCH_HEAD
git log -1 --oneline
# must be NEWER than b06c8e0 — look for “multi-page” or later commits

npm run web:clean
npm run curriculum:prepare
# Restore multi-page G8 Integrated Science (safe even after rebuild-study)
npm run content:g8-is-pages
cd web
npm run dev
```

Hard refresh: **Ctrl+F5**

If fetch keeps failing, ZIP install:  
https://github.com/Murphy601/General/archive/refs/heads/cursor/cbc-learning-website-0ec7.zip

### Check URL
- http://localhost:3000/learn/grade-8/integrated-science
- Open **1.1 Elements and Compounds**
- Expect **8 study pages**, pages 1–3 free, page 4+ locked

## Rebuild all classroom lessons locally

```powershell
cd C:\Users\user\General
npm run content:rebuild-study
# rebuild-study now auto-runs content:g8-is-pages at the end
npm run content:generate-exams:all
npm run content:ingest-past-papers
```

Or only refresh Grade 8 Integrated Science multi-page lessons:

```powershell
npm run content:g8-is-pages
```
