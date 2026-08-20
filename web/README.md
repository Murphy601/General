# HighTech CBC Learners — Monetizable Learning Platform

**Not a KICD mirror.** Official curriculum PDFs are the *source engine*. This platform sells AI-generated learning products for **PP1, PP2, and Grade 1–12**.

**Live:** https://hightech-cbc-learners.mikeal-murphy.workers.dev

Pull **`main`**, not the old `cursor/cbc-learning-website-0ec7` branch.

## What this platform is

| Tab | Purpose |
|-----|---------|
| **Dashboard** | PP1–Grade 12 grade picker (Pre-Primary first) |
| **Learning Docs** | `/docs` — PP1 and PP2 first, then Grade 1–12; pull **`main`** |
| **Revision Hub** | Termly exams, quizzes, mock papers |
| **Video Hub** | Lesson scripts (render pipeline later) |
| **Studio** | Generate content from KICD via RAG + LLM |
| **Pricing** | M-Pesa STK Push plans |
| **Account** | Sign up, sign in, membership |

## Content pipeline

```
KICD PDFs (harvested) → RAG retrieval → AI draft → Teacher review → Publish → Sell via M-Pesa
```

## Quick start (Windows PowerShell)

**Do not type `OPENAI_API_KEY=...` in the terminal.** That is Linux syntax. Put your key in `.env` only.

```powershell
cd C:\Users\user\General
git checkout main
git pull origin main
npm run setup

copy .env.example .env
notepad .env
# Paste your OpenRouter key on the OPENAI_API_KEY= line, save, close Notepad

npm run curriculum:prepare
npm run rag:embed:resume

# If you get EPERM on web\.next\trace, clean and restart:
npm run web:clean
npm run web:dev
```

Or use the all-in-one PowerShell helper:

```powershell
.\scripts\web-dev.ps1
```

Open http://localhost:3000 — **PP1 and PP2** are on the home page under Pre-Primary. Docs: `/docs`. Account is `/account`; M-Pesa checkout is `/pricing`.

### Fix: `EPERM: operation not permitted, open web\.next\trace`

Another Next.js instance is usually still running (often on port 3000). In PowerShell:

```powershell
Get-Process -Name node | Stop-Process -Force
npm run web:clean
npm run web:dev
```

### PowerShell env vars (only if you skip .env)

```powershell
$env:OPENAI_API_KEY = "sk-or-v1-your-key"
$env:OPENAI_BASE_URL = "https://openrouter.ai/api/v1"
```

## Quick start (Windows CMD)

```cmd
copy .env.example .env
notepad .env
set OPENAI_API_KEY=sk-or-v1-your-key
npm run web:clean
npm run web:dev
```

## Video production (manual step after script)

1. Studio generates video script
2. ElevenLabs → Kenyan-friendly voice MP3
3. InVideo / HeyGen → render 720p MP4
4. Upload to Bunny.net → paste embed URL on video page

## Accounts and M-Pesa

- `/account` — email + password (D1 on the Worker; `web/.data/accounts.sqlite` in `next dev`)
- `/pricing` — STK Push; `/api/mpesa/callback` is the payment source of truth
- Monthly/termly plans unlock study pages after the 3-page free preview
- Worker secrets: `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`

Teacher review workflow and marketplace are still later work.
