# CBC Learn — Monetizable Learning Platform

**Not a KICD mirror.** Official curriculum PDFs are the *source engine*. This platform sells AI-generated learning products.

## What this platform is

| Tab | Purpose |
|-----|---------|
| **Dashboard** | Progress, recommendations, pipeline overview |
| **Learning Docs** | AI-generated notes (KICD-grounded, Kenyan examples) |
| **Revision Hub** | Termly exams, quizzes, mock papers (pay-per-download) |
| **Video Hub** | Cached 5-min lesson reels (script → render once → Bunny.net) |
| **Studio** | Generate content from KICD via RAG + LLM |
| **Pricing** | M-Pesa plans (integration Phase 2) |

## Content pipeline

```
KICD PDFs (harvested) → RAG retrieval → AI draft → Teacher review → Publish → Sell via M-Pesa
```

## Quick start (Windows PowerShell)

**Do not type `OPENAI_API_KEY=...` in the terminal.** That is Linux syntax. Put your key in `.env` only.

```powershell
cd C:\Users\user\General
git pull
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

Open http://localhost:3000 → **Studio** → generate notes, exam, quiz, or video script.

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

## Phase 2 (not built yet)

- M-Pesa STK Push (Daraja / Paynecta)
- User accounts & membership unlock
- Teacher review workflow
- Teacher marketplace (20–30% commission)
