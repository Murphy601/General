# AGENTS.md

## Cursor Cloud specific instructions

### What this is
CBC Learn is a Kenyan CBC learning platform. The only long-running **service** is the Next.js app in `web/` (App Router, Next 15 + React 19). The repo root is a Node toolchain of content-generation scripts (`scripts/*.mjs`, see `package.json`); those are batch jobs, not services.

### Running the app (dev)
- Start it from `web/`: `npm run dev` (serves http://localhost:3000). Key routes: `/learn`, `/revision`, `/studio`, `/`.
- The root `npm run web:dev` also works but first runs `scripts/check-env.mjs`, which **hard-fails without a `.env` containing a real `OPENAI_API_KEY`**. For browsing Learn/Revision you do NOT need that key, so prefer `npm --prefix web run dev` (or `cd web && npm run dev`).

### Content data (why the app works with no API key)
- Lessons/quizzes/answers are committed as ~42k JSON files under `web/data/content/`, and `web/public/data/catalog.json` (the grade→subject→topic index) is committed too. So Learn and Revision Hub render fully offline.
- `OPENAI_API_KEY` (OpenRouter) is only needed for the **Studio** generation endpoints (`/api/generate`, `/api/rag/query`) and the CLI content/RAG scripts. Put it in a repo-root `.env` (see `.env.example`); `web/next.config.ts` loads that root `.env` for the web server.
- `knowledge-base/phase3/curriculum-text.json` is gitignored and only needed to *rebuild* the catalog/RAG. Regenerate it with `npm run curriculum:prepare` (decompresses the committed `.gz`), then `npm run web:catalog` to rewrite `catalog.json`. Do not commit the regenerated `catalog.json` unless intentionally updating content — the committed version is authoritative.

### Lint
- `next lint` is **not configured** in this repo (no ESLint config committed). Running `npm run lint` in `web/` launches Next's interactive ESLint setup prompt and will hang in a non-interactive shell. There is no working lint step; type-check via `npm --prefix web run build` instead if needed.

### Notes
- Node 22 / npm 10 work fine. Python 3 is only used by a couple of `content:g8-is-*` ingest scripts.
