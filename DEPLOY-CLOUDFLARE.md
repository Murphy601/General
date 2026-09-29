# Deploy to Cloudflare Workers (OpenNext + R2)

The site runs as a Cloudflare Worker. Lessons and exams are **not** bundled: they live in an R2 bucket
(`cbc-content`, bound as `CONTENT`) and are read by `web/src/lib/storage.ts`. Locally (`npm run dev`) the same code
reads `web/data/content` from disk, so nothing changes for development.

## One-time setup (run from `web/`)
```bash
npm install
npx wrangler login                       # or set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
npx wrangler r2 bucket create cbc-content
```

## Publish content, then deploy
```bash
# from the repo root: stage + upload the grades you want live (pass ALL live grades every time)
node scripts/publish-r2.mjs --grades grade-4          # ~1,750 objects, roughly 20 min via wrangler
# then
cd web && npm run cf:deploy
```
Wrangler prints the site URL (`https://cbc-learn.<your-subdomain>.workers.dev`).

Faster bulk upload: `node scripts/publish-r2.mjs --grades grade-4 --stage-only` writes everything to `web/.r2-stage/`,
which you can sync with `rclone` (R2 S3 endpoint) instead of wrangler.

## Try it locally first (simulated R2)
```bash
node scripts/publish-r2.mjs --grades grade-4 --local
cd web && npm run cf:preview
```

## Notes
- Only grades passed to `--grades` appear on the site (Learn, Revision Hub, Videos). Others are hidden.
- `/api/generate`, `/api/generate/batch` and `/api/rag/query` return 501 on Workers (they need the filesystem and
  local scripts). Generate content locally, commit, and re-publish.
- Worker size is ~1 MB gzipped, well inside the limits. `web/public/media` is served as static assets.
- Object layout: `content/<id>.json`, `index/<grade>.json`, `index/grades.json`, `index/counts.json`,
  `curriculum/<grade>.json`, `curriculum/grades.json`.
