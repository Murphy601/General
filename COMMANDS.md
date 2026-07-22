# Windows — get classroom study lessons

## Force update (fetch often fails on Windows)

```powershell
cd C:\Users\user\General
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

git config --global http.postBuffer 524288000
git config --global http.version HTTP/1.1
git fetch --depth 1 origin cursor/cbc-learning-website-0ec7
git reset --hard FETCH_HEAD
git log -1 --oneline
# must NOT be b06c8e0

npm run web:clean
npm run curriculum:prepare
cd web
npm run dev
```

If fetch keeps failing, ZIP install:  
https://github.com/Murphy601/General/archive/refs/heads/cursor/cbc-learning-website-0ec7.zip

Hard refresh: **Ctrl+F5**

### Check multi-page Grade 8 Integrated Science
- http://localhost:3000/learn/grade-8/integrated-science
- Open **1.1 Elements and Compounds**
- Pages 1–3 free; page 4+ shows unlock / paywall card

```powershell
npm run content:g8-is-pages
```

## Rebuild all classroom lessons locally

```powershell
cd C:\Users\user\General
npm run content:rebuild-study
npm run content:generate-exams:all
npm run content:ingest-past-papers
npm run content:g8-is-pages
```

Lessons, Revision Hub quizzes, and Video Hub scripts are generated together from the same classroom packs.
Multi-page topics support free preview pages + locked pages for M-Pesa unlock.
