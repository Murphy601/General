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
    └── pdf-catalog.json    # Known direct KICD PDF downloads
```

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
