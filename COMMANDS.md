# Windows — sync CBC Learn (content already generated in git)

You do **not** need to regenerate lessons on your PC. Pull the branch and run the site.

## Sync (recommended)

```powershell
cd C:\Users\user\General
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

git fetch --depth 1 origin cursor/cbc-learning-website-0ec7
git reset --hard FETCH_HEAD
git clean -fd
git log -1 --oneline
# expect: study-drama-engine-v1 (Study-Content & Drama Engine)

cd web
npm run dev
```

Hard refresh: **Ctrl+F5**

### Check Grade 8 Integrated Science
http://localhost:3000/learn/grade-8/integrated-science/1-1-elements-and-compounds

You should see:
- **20 study pages** per topic (plain-text house style: ALL-CAPS titles + `====` / `----`)
- CBC framing + 5 sections + Q1–Q3 / A1–A3 on every page
- No markdown `#` / `**` / `|---|` / code fences
- Video Hub: **screen-drama** episode (story-specific cast, acted scenes — not narrator notes)

## Optional: regenerate (cloud/agent)

```powershell
cd C:\Users\user\General
npm run content:g8-is-pages
```

Master prompt: `knowledge-base/prompts/study-content-drama-engine.md`  
Builder modules: `scripts/study-drama/` + `scripts/build-g8-integrated-science-pages.mjs`  
`contentSource`: `study-drama-engine-v1`
