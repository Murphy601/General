# Windows — sync CBC Learn (content already generated in git)

You do **not** need to regenerate on your PC. Pull the branch and run the site.

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

### What you should see

**Revision Hub (PP1–Grade 12)**  
Every subject · every tier (General / Termly / Mock / Premium) → **20 papers**  
Real questions — not “Learners should ignore…” junk.

**Learn (PP1–Grade 12)**  
Topics have **20 study pages** (Study-Drama house style) including:
- Worked examples with **formula → substitution → steps** (math/science)
- **`[DIAGRAM]`** figures (SVG / figure-prompts) rendered in the viewer
- Screen-drama video script per topic  

Grade 8 Integrated Science keeps the handcrafted drama pack.

Examples:
- http://localhost:3000/revision/premium/grade-7/mathematics
- http://localhost:3000/revision/premium/pp1/mathematical-activities
- http://localhost:3000/learn/grade-8/integrated-science/1-1-elements-and-compounds
- http://localhost:3000/learn/grade-4/mathematics (any topic → 20 pages)

### Optional regenerate (cloud/agent)

```powershell
npm run content:universal-exams
npm run content:universal-lessons
npm run content:g8-is-pages
npm run content:study-drama-exams
```
