# CBC Learn — Windows setup

Run these in **PowerShell** from the project folder (`C:\Users\user\General`).

## First-time / after a failed pull

```powershell
cd C:\Users\user\General

# Stop anything locking web\.next (old Next.js / node)
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# Discard or stash local edits that block git pull
git restore web/data/content/index.json web/package-lock.json web/package.json web/public/data/catalog.json 2>$null
git stash push -u -m "local-before-pull" 2>$null

# Get latest
git fetch origin
git checkout cursor/cbc-learning-website-0ec7
git pull origin cursor/cbc-learning-website-0ec7

# Refresh curriculum catalog from the committed .gz (important after pull)
npm run curriculum:prepare

# Optional: re-ingest PP1/PP2/G1-3 from local PDFs if you have poppler (pdftotext)
# npm run content:ingest-early
# npm run content:index

# Clean Next cache, then start
npm run web:clean
cd web
npm run dev
```

Open the URL Next prints (e.g. `http://localhost:3000/learn`).

## If `EPERM` on `web\.next\trace`

Another Node process still holds the folder. Kill Node, clean, restart:

```powershell
cd C:\Users\user\General
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
npm run web:clean
cd web
npm run dev
```

## If `git pull` says local changes would be overwritten

```powershell
cd C:\Users\user\General
git restore web/data/content/index.json
git pull origin cursor/cbc-learning-website-0ec7
```

Or stash everything:

```powershell
git stash push -u -m "wip"
git pull origin cursor/cbc-learning-website-0ec7
```
