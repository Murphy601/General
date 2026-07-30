# KICD CBC Knowledge Base

Local structured index of Kenya Institute of Curriculum Development (KICD) CBC curriculum hub pages.

## Structure

```
knowledge-base/
├── index.json              # Master index + crawl run IDs
├── url-map.json            # Machine-readable URL map by level
├── URL-MAP.md              # Human-readable URL reference
├── general/                # 7 general material pages
├── pre-primary/            # PP hub
├── lower-primary/          # Grades 1-3 hub
├── curriculum-roots/       # Design navigation hubs
├── regular/                # Grades 4-12 (grade-4 … grade-12)
│   └── grade-N/page.json
├── sne/
│   ├── hearing-impairment/ # HI PP1–Grade 10
│   ├── physical-impairment/# PI PP1–Grade 10
│   ├── visual-impairment/  # VI PP1–Grade 10
│   ├── prevocational/
│   └── vocational/
└── phase2/
    ├── dataset-summary.json
    ├── pdf-catalog.json         # Known direct KICD PDF downloads
    ├── drive-links.json         # 585 harvested Google Drive file IDs
    ├── drive-catalog-summary.json
    └── download-manifest.json   # Last download run results
```

PDF binaries are saved under `knowledge-base/pdfs/[grade]/` when you run the download script (not committed to git).

## PDF pipeline (Google Drive embeds)

```bash
# Phase 1 — harvest Drive links (local, no Apify token required)
npm run drive:harvest:local

# Phase 1 alt — Apify web-scraper (needs APIFY_TOKEN + actor permission)
npm run drive:harvest

# Phase 2 — convert file IDs to direct download URLs (included in drive-links.json)
# Phase 3 — download PDFs
npm run pdfs:download:direct   # 7 working KICD wp-content PDFs
npm run pdfs:download            # direct + Drive (Drive files are download-restricted)
```

**Note:** KICD embeds most Gr 4–12 subject PDFs via Google Drive with download restrictions. The pipeline successfully harvests **585 file IDs**, but Google returns `Can't download file` for automated direct downloads. Use KICD direct links, KEC/OER portals, or manual copy/print for those files.

## KEC mirror harvest (Kenya Education Cloud)

```bash
npm run kec:harvest           # crawl lms.kec.ac.ke + /ebooks/ listings
npm run pdfs:download:kec     # download harvested KEC PDFs
```

Output: `knowledge-base/phase2/kec-mirrors.json` — direct downloadable PDFs from `lms.kec.ac.ke/ebooks/`, `pluginfile.php`, and `epubs.kec.ac.ke`.

## Phase 3 — Google Drive visual DOM extraction (curriculum designs)

Direct Drive downloads are blocked, but the preview viewer renders text in the browser. This pipeline opens each preview URL in Playwright/Puppeteer and extracts the rendered DOM text.

```bash
# 1. Generate Apify input from 585 harvested Drive links
node scripts/generate-drive-visual-input.mjs --limit 50   # or omit --limit for all

# 2a. Cloud run (Apify web-scraper + Playwright)
export APIFY_TOKEN=...
npm run drive:visual:harvest

# 2b. Local validation (no Apify token)
npm run drive:visual:local -- --limit 5

# 3. Merge Apify dataset into curriculum text catalog
node scripts/merge-curriculum-text.mjs --dataset <datasetId>
```

Output: `knowledge-base/phase3/curriculum-text.json`

Validated locally: Agriculture Grade 4 curriculum design extracts full FOREWORD/PREFACE text from `drive.google.com/file/d/.../preview` without login.

## Phase 4 — RAG chunking + embeddings

```bash
# Chunk extracted curriculum text
npm run rag:chunk

# Build chunks only (no API key needed)
npm run rag:build:chunks

# Generate OpenAI embeddings (requires OPENAI_API_KEY)
export OPENAI_API_KEY=...
npm run rag:build

# Query the index
npm run rag:query -- "Grade 4 agriculture learning outcomes"
```

Outputs:
- `knowledge-base/phase4/curriculum-chunks.json` — chunked text with grade/subject metadata
- `knowledge-base/phase4/curriculum-embeddings.json` — chunks + embedding vectors

For full local harvest without Apify permissions:

```bash
node scripts/run-drive-visual-local-batch.mjs --batch-size 50 --offset 0
```

## Phase 5 — Web app

```bash
npm run web:dev     # catalog + Next.js dev server (http://localhost:3000)
npm run web:build   # production build
npm run web:start   # serve production build
```

See `web/README.md` for environment setup (OpenRouter API key, embeddings).

## Crawl runs

| Phase | Run ID | Dataset | Pages |
|-------|--------|---------|-------|
| 1 | `Q6BEwe9YErgWNFAOm` | `4rvft4eo7PKWlPekp` | 70 |
| 2 | `sJucsMRQKoeWpXSUM` | `mvcpflci6yzv1OeQz` | 60 |

## Regenerate

```bash
node scripts/build-knowledge-base.mjs
node scripts/apply-phase2-subjects.mjs
```

## Notes

- Grade hub PDFs on KICD often use **Google Drive embeds** (not direct download links).
- Use `knowledge-base/phase2/pdf-catalog.json` for **direct** `wp-content/uploads` PDFs (PP1, PP2, Lower Primary volumes).
- Regular grades 4–9 subject lists were extracted in Phase 2 crawl.
