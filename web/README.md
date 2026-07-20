# CBC Learn Web App

Next.js frontend for browsing KICD curriculum designs, AI-powered revision, and practice quizzes.

## Quick start

From the **repository root**:

```bash
# 1. Ensure curriculum text is prepared
npm run curriculum:prepare

# 2. (Optional) Build RAG embeddings for semantic search
set OPENAI_API_KEY=your_key
set OPENAI_BASE_URL=https://openrouter.ai/api/v1
npm run rag:embed

# 3. Build catalog + start dev server
npm run web:dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Copy `web/.env.example` to `web/.env.local`:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenRouter or OpenAI API key |
| `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` for OpenRouter |
| `OPENAI_EMBEDDING_MODEL` | e.g. `openai/text-embedding-3-small` |
| `OPENAI_CHAT_MODEL` | e.g. `openai/gpt-4o-mini` |

Without embeddings, revision and quiz fall back to keyword search over `curriculum-chunks.json`.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — overview and grade shortcuts |
| `/browse` | All grades |
| `/browse/[grade]` | Subjects for a grade |
| `/study/[grade]/[subject]` | Documents for a subject |
| `/document/[fileId]` | Full curriculum text viewer |
| `/revision` | RAG revision assistant chat |
| `/quiz` | Auto-generated practice quizzes |

## Production

```bash
npm run web:build
npm run web:start
```
