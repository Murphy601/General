# Windows — get the REAL latest lessons

## Why you still see old dumps

Your log shows:

1. `git fetch` **FAILED** (network cut off)
2. `git reset --hard` moved to **`b06c8e0`** — an **old** commit  
   Latest study lessons are on a **newer** commit (not b06c8e0)
3. `web:clean` failed because **Node is still running**

So you never downloaded the new lessons.

---

## Step 1 — Kill Node, then fetch (retry until it works)

```powershell
cd C:\Users\user\General

Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

git config --global http.postBuffer 524288000
git config --global http.version HTTP/1.1

# Retry this until it says it downloaded objects (no "early EOF")
git fetch --depth 1 origin cursor/cbc-learning-website-0ec7
```

If fetch keeps failing, use ZIP instead:

1. Open: https://github.com/Murphy601/General/archive/refs/heads/cursor/cbc-learning-website-0ec7.zip
2. Extract over `C:\Users\user\General` (replace files)
3. Continue from Step 2

---

## Step 2 — Reset to the fetched branch tip

```powershell
cd C:\Users\user\General
git checkout cursor/cbc-learning-website-0ec7
git reset --hard FETCH_HEAD
# If FETCH_HEAD missing after ZIP install, skip reset and continue
```

Check you are NOT on the old commit:

```powershell
git log -1 --oneline
```

You must **NOT** see `b06c8e0`.  
You should see a message about **study lessons** / **Past Paper Vault**.

---

## Step 3 — Clean cache and start

```powershell
npm run web:clean
npm run curriculum:prepare
cd web
npm run dev
```

Hard refresh browser: **Ctrl+F5**

Check:

- http://localhost:3000/learn/grade-4/mathematics/1-4-multiplication-8  
  → must show **SECTION 3: STUDY NOTES** and `24 × 10 = 240`
- http://localhost:3000/revision/vault  
  → Past Paper Vault

---

## Optional — rebuild ALL grades/subjects on your PC

Only if you already have the latest code:

```powershell
cd C:\Users\user\General
npm run content:rebuild-study
```

This regenerates **PP1–Grade 9, every subject** as pupil study lessons (not teacher guides).

---

## Quick checks

| Symptom | Cause | Fix |
|--------|--------|-----|
| Still SECTION 7 dump | Old commit / failed fetch | Step 1–2 again |
| `EPERM` on `.next` | Node still running | Stop-Process node, then web:clean |
| `git log` shows `b06c8e0` | Fetch never succeeded | Retry fetch or use ZIP |
