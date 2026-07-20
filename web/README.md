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

## Quick start (Windows CMD)

```cmd
cd C:\Users\user\General
git pull
npm run setup

copy .env.example .env
notepad .env
REM Paste your OpenRouter sk-or-v1-... key

npm run curriculum:prepare
npm run rag:embed:resume
npm run web:dev
```

Open http://localhost:3000 → **Studio** → generate notes, exam, quiz, or video script.

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
