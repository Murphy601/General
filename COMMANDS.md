# Windows — get multi-page Grade 8 Integrated Science

## FIRST: open the project folder

Do **not** run commands from `C:\Users\user`.

```powershell
cd C:\Users\user\General
dir package.json
# must show package.json — if missing, find the repo:
Get-ChildItem -Path C:\Users\user -Filter package.json -Recurse -ErrorAction SilentlyContinue -Depth 4 |
  Where-Object { $_.DirectoryName -match 'General' } |
  Select-Object -ExpandProperty DirectoryName
```

If you never cloned the repo:

```powershell
cd C:\Users\user
git clone https://github.com/Murphy601/General.git
cd General
git fetch --depth 1 origin cursor/cbc-learning-website-0ec7
git checkout cursor/cbc-learning-website-0ec7
```

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

# IMPORTANT: discard local content edits so checkout cannot abort
git reset --hard FETCH_HEAD
git clean -fd
git checkout -B cursor/cbc-learning-website-0ec7 FETCH_HEAD
git log -1 --oneline
# must show ba556337 or NEWER (not c8d3af8b / b06c8e0)

npm run web:clean
npm run curriculum:prepare
npm run content:g8-is-pages
# SUCCESS looks like:
#   Building STUDENT study pages ... all pages UNLOCKED
#   1.1 ... student pages
# FAIL (old) looks like: freePages=3 / SECTION 1: WELCOME / teacher Requirements lists

cd web
npm run dev
```

Hard refresh: **Ctrl+F5**

If fetch keeps failing, ZIP install:  
https://github.com/Murphy601/General/archive/refs/heads/cursor/cbc-learning-website-0ec7.zip

### Check URL
- http://localhost:3000/learn/grade-8/integrated-science
- Open **1.1 Elements and Compounds**
- Expect **many study pages** (e.g. 16+), **all unlocked** for now
- Page locks will be turned on at publish (`npm run content:g8-is-pages -- --lock`)

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
