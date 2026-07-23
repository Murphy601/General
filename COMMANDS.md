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

cd web
npm run dev
```

Hard refresh: **Ctrl+F5**

### Check Grade 8 Integrated Science
http://localhost:3000/learn/grade-8/integrated-science/1-1-elements-and-compounds

You should see:
- **20 study pages** — real teaching prose (no skeleton intros, no Q1/A1 scaffolding)
- Sections: What you will learn → Introduction → Main Notes → Worked Example → Everyday Life → Summary → Revision Questions → Answers
- Diagrams rendered from `[DIAGRAM]` blocks where present
- Revision Hub: **20 papers per tier** (General / Termly / Mock / Premium) for G8 Integrated Science
- Video Hub: screen-drama episodes

## Optional: regenerate (cloud/agent)

```powershell
cd C:\Users\user\General
npm run content:g8-is-pages
npm run content:study-drama-exams
```

Master prompt: `knowledge-base/prompts/study-content-drama-engine.md`  
Modules: `scripts/study-drama/`  
`contentSource`: `study-drama-engine-v1` (lessons) · `study-drama-exam-v1` (exams)
