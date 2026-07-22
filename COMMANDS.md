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
# expect: student textbook / v4 commit (not old WELCOME template)

cd web
npm run dev
```

Hard refresh: **Ctrl+F5**

### Check Grade 8 Integrated Science
http://localhost:3000/learn/grade-8/integrated-science/1-1-elements-and-compounds

You should see:
- `PAGE 1 OF 11: ATOMS, ELEMENTS AND COMPOUNDS`
- Sections: **Comprehensive concept explanation**, **Worked example**, **Visual model**, **Practical application**, **Practice questions**, **Solutions**
- No `SECTION 1: WELCOME`, no “Today’s idea / Today we study / Your turn”

Revision Hub exams for Grade 8 Integrated Science are also in the branch (general, termly, mock, premium).

## Optional: regenerate later (cloud/agent or advanced)

```powershell
cd C:\Users\user\General
npm run curriculum:prepare
npm run content:g8-is-pages
node scripts/batch-generate-exams.mjs --grade grade-8 --subject "INTEGRATED SCIENCE" --reset --no-llm
```

System prompt used for modules: `knowledge-base/prompts/student-textbook-module.md`
