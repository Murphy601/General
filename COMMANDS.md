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
# expect: g8-is-engine-v5 / dual notes+video (not old WELCOME template)

cd web
npm run dev
```

Hard refresh: **Ctrl+F5**

### Check Grade 8 Integrated Science
http://localhost:3000/learn/grade-8/integrated-science/1-1-elements-and-compounds

You should see:
- Consolidated multipage modules (Topic 1.1 ≈ 4 pages), not the old `SECTION 1: WELCOME` classroom template
- Each page: **Concept Overview → Practical Examples & Formulas → Visual Description → Applications & Safety → Practice + Model Solutions**
- Unique examples per page (no copy-pasted Worked Example / Visual Model loops)
- No raw markdown tables (`|---|`) or ASCII/code-block diagrams
- Correct symbols (Nitrogen → **N**, not Helium)
- Matching **Video Hub** cartoon script with Dr. Amani, Jabali & Makena (4 timed scenes)

Revision Hub exams for Grade 8 Integrated Science are also in the branch (general, termly, mock, premium).

## Optional: regenerate later (cloud/agent or advanced)

```powershell
cd C:\Users\user\General
npm run curriculum:prepare
npm run content:g8-is-pages
node scripts/batch-generate-exams.mjs --grade grade-8 --subject "INTEGRATED SCIENCE" --reset --no-llm
```

Engine prompt: `knowledge-base/prompts/g8-is-content-engine.md`  
Builder: `scripts/build-g8-integrated-science-pages.mjs` (`contentSource: g8-is-engine-v5`)
