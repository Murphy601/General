#!/usr/bin/env node
/**
 * Ingest freely published KNEC / KPSEA / SBA past papers from open education catalogs
 * (e.g. Shulefiti) into the Revision Hub "Past Paper Vault".
 *
 * We store catalog metadata + public Drive/PDF links. We do NOT scrape commercial textbooks.
 *
 * Usage:
 *   node scripts/ingest-open-past-papers.mjs
 *   node scripts/ingest-open-past-papers.mjs --refresh
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'web', 'data', 'content');
const INDEX_FILE = join(CONTENT_DIR, 'index.json');
const CATALOG = join(ROOT, 'knowledge-base', 'phase5', 'open-past-papers.json');

/**
 * Curated free KPSEA / sample papers published on open education blogs (Shulefiti Drive links).
 * Add more entries here or refresh via --refresh when a live catalog fetch is available.
 */
const SEED_PAPERS = [
  // KPSEA 2025
  { year: 2025, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'CREATIVE ARTS AND SOCIAL STUDIES', title: 'KPSEA 2025 Creative Arts & Social Studies', driveId: '1SxI9dIU35LQaOi7vYy-i1FsPXhzrj3kE', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2025, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'ENGLISH', title: 'KPSEA 2025 English Language', driveId: '1Al3n79htrM0R6d_mMo2yZGH8dxpmMDNI', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2025, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'INTEGRATED SCIENCE', title: 'KPSEA 2025 Integrated Science', driveId: '16kGgyqFv-IVm1EFzz7iOwdfHvwJqvNpg', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2025, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'KISWAHILI', title: 'KPSEA 2025 Kiswahili', driveId: '1aHXncDAnZhmt_rVZ_FtFJD28N8fz5pjW', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2025, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'MATHEMATICS', title: 'KPSEA 2025 Mathematics', driveId: '1uydarGLxv9FEgn_197utV-X4Job46tLl', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  // KPSEA samples
  { year: 0, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'ENGLISH', title: 'Grade 6 English KPSEA Sample', driveId: '1XlkFq6jl_DdPeZj05X2r0Hn-7jR7Fq4F', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers', series: 'sample' },
  { year: 0, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'INTEGRATED SCIENCE', title: 'Grade 6 Integrated Science KPSEA Sample', driveId: '1qKWL3FF4-aFN-P7_ncc8g-rBC8iy6sVU', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers', series: 'sample' },
  { year: 0, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'KISWAHILI', title: 'Grade 6 Kiswahili KPSEA Sample', driveId: '1fYVDPJmjwdoPurUO0bgLdzX264oDQMe6', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers', series: 'sample' },
  { year: 0, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'MATHEMATICS', title: 'Grade 6 Mathematics KPSEA Sample', driveId: '1dAOEBy_M24KPxTdVROZH2Xa9-nIpzFvt', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers', series: 'sample' },
  { year: 0, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'CREATIVE ARTS AND SOCIAL STUDIES', title: 'Grade 6 Creative Arts & Social Studies KPSEA Sample', driveId: '1Yls5zgisp4D_5nKVXgPlIui0kH6wlF11', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers', series: 'sample' },
  { year: 0, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'KSL', title: 'Grade 6 KSL KPSEA Sample', driveId: '1PjME6x1v7HnpnKoQXwfKXKOSrOqulb6d', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers', series: 'sample' },
  // KPSEA 2024
  { year: 2024, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'CREATIVE ARTS AND SOCIAL STUDIES', title: 'KPSEA 2024 Creative Arts & Social Studies', driveId: '1626A9MNzLdtejvopB1bHxsiiHx30mTLO', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2024, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'ENGLISH', title: 'KPSEA 2024 English', driveId: '1eYWEiBFTJVOJaSiLR4OnA_nBSebOm5Tk', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2024, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'INTEGRATED SCIENCE', title: 'KPSEA 2024 Integrated Science', driveId: '1VHpPr0AkJ23wb9L6QKdClu9RWAcAnbAJ', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2024, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'KISWAHILI', title: 'KPSEA 2024 Kiswahili', driveId: '14Wjx4Dp3Pr2ltyHHZjuWhDSBLGUDSzny', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2024, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'MATHEMATICS', title: 'KPSEA 2024 Mathematics', driveId: '1_4Le4QA-SGUim-3xzZI-bGObxjhIFIsI', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  // KPSEA 2023
  { year: 2023, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'CREATIVE ARTS AND SOCIAL STUDIES', title: 'KPSEA 2023 Creative Arts & Social Studies', driveId: '1rLnj8cZptfk15y5bCQdDliygV-Oor5ec', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2023, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'ENGLISH', title: 'KPSEA 2023 English Language', driveId: '1K5SVcg5it2043IoG2hTbWljpi3RqhG6S', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2023, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'INTEGRATED SCIENCE', title: 'KPSEA 2023 Integrated Science', driveId: '1QXUFUzwf3YbTJdikYdbCm-L6MvUR5d94', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2023, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'KISWAHILI', title: 'KPSEA 2023 Kiswahili Lugha', driveId: '131zfMyGE9ab7tuPFQhhe2QIEQZkpbyI8', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2023, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'MATHEMATICS', title: 'KPSEA 2023 Mathematics', driveId: '1j-46hnhgCCqXuhfcZSe9az3aZtwYz2l2', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  // KPSEA 2022
  { year: 2022, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'CREATIVE ARTS AND SOCIAL STUDIES', title: 'KPSEA 2022 Creative Arts & Social Studies', driveId: '1NYIDMg2dOtt_jOQ2UT8ctyA7Z3890Ar8', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2022, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'ENGLISH', title: 'KPSEA 2022 English Language', driveId: '1_875qtPMwBhpE-dpC726CVHugp_npP2D', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2022, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'INTEGRATED SCIENCE', title: 'KPSEA 2022 Integrated Science', driveId: '1kZNyAtAav6H59P_6EcDQ5razlvF0uMFJ', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2022, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'KISWAHILI', title: 'KPSEA 2022 Kiswahili Lugha', driveId: '1ay_N4L1NmvcM-4p62IiivzdMKG0mFtL1', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
  { year: 2022, grade: 'grade-6', gradeLabel: 'Grade 6', subject: 'MATHEMATICS', title: 'KPSEA 2022 Mathematics', driveId: '13nDspukzLE8uqkUF-XN7Atad-_aF0VBR', source: 'Shulefiti', sourceUrl: 'https://www.shulefiti.co.ke/primary/knec-kpsea-past-papers' },
];

function driveViewUrl(id) {
  return `https://drive.google.com/file/d/${id}/view`;
}

function driveDownloadUrl(id) {
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

function loadIndex() {
  if (!existsSync(INDEX_FILE)) return [];
  return JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
}

function saveIndex(index) {
  mkdirSync(CONTENT_DIR, { recursive: true });
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

function paperKey(p) {
  return `vault|${p.year || 'sample'}|${p.grade}|${p.subject}|${p.driveId}`;
}

function buildRecord(p) {
  const id = randomUUID();
  const yearLabel = p.year ? String(p.year) : 'Sample';
  const series = p.series === 'sample' ? 'KPSEA Sample' : `KPSEA ${yearLabel}`;
  const viewUrl = driveViewUrl(p.driveId);
  const downloadUrl = driveDownloadUrl(p.driveId);

  const body = [
    `${p.title}`.toUpperCase(),
    '',
    `Series: ${series}`,
    `Grade: ${p.gradeLabel}`,
    `Subject: ${p.subject}`,
    `Source: ${p.source} (open education catalog)`,
    '',
    'This paper is listed from a freely published open-education collection for revision practice.',
    'Open the PDF from the link below (hosted by the publisher / Google Drive).',
    '',
    `View PDF: ${viewUrl}`,
    `Download: ${downloadUrl}`,
    '',
    `Catalog page: ${p.sourceUrl}`,
    '',
    'Tip: Attempt the paper under timed conditions, then mark with a parent or teacher.',
  ].join('\n');

  return {
    id,
    type: 'past-paper',
    title: p.title,
    topic: {
      grade: p.grade,
      gradeLabel: p.gradeLabel,
      subject: p.subject,
    },
    pages: {
      lesson: '',
      quiz: body,
      answers: `Marking: Use the official / published marking scheme where available from ${p.source}.\nPDF: ${viewUrl}`,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: body.split(/\s+/).length,
      reviewed: false,
      access: 'free',
      priceKes: 0,
      category: 'vault',
      year: p.year || null,
      series,
      externalUrl: viewUrl,
      downloadUrl,
      sourceSite: p.source,
      sourcePage: p.sourceUrl,
      driveId: p.driveId,
      contentSource: 'open-past-paper-catalog',
    },
    sources: [
      {
        id: p.driveId,
        grade: p.grade,
        subject: p.subject,
        excerpt: `${p.title} via ${p.source}`,
      },
    ],
  };
}

const args = { refresh: process.argv.includes('--refresh') };

mkdirSync(dirname(CATALOG), { recursive: true });
writeFileSync(
  CATALOG,
  JSON.stringify(
    {
      version: 1,
      updatedAt: new Date().toISOString(),
      source: 'Shulefiti KPSEA past papers catalog',
      papers: SEED_PAPERS,
    },
    null,
    2,
  ),
);

let index = loadIndex();
const existingKeys = new Set(
  index
    .filter((i) => i.type === 'past-paper')
    .map((i) => paperKey({
      year: i.metadata?.year,
      grade: i.topic?.grade,
      subject: i.topic?.subject,
      driveId: i.metadata?.driveId,
    })),
);

let created = 0;
let skipped = 0;

for (const p of SEED_PAPERS) {
  // Skip incomplete drive ids
  if (!p.driveId || p.driveId.length < 20) {
    console.log(`  SKIP incomplete id: ${p.title}`);
    skipped += 1;
    continue;
  }
  const key = paperKey(p);
  if (!args.refresh && existingKeys.has(key)) {
    skipped += 1;
    continue;
  }

  // Remove old vault entry for same drive id on refresh
  if (args.refresh) {
    index = index.filter((i) => !(i.type === 'past-paper' && i.metadata?.driveId === p.driveId));
  }

  const record = buildRecord(p);
  writeFileSync(join(CONTENT_DIR, `${record.id}.json`), JSON.stringify(record, null, 2));
  index.unshift({
    ...record,
    pages: {
      lesson: '',
      quiz: record.pages.quiz.slice(0, 220) + '…',
      answers: '',
    },
  });
  existingKeys.add(key);
  created += 1;
  console.log(`  ✓ ${record.title}`);
}

saveIndex(index);
console.log(`\nPast Paper Vault: created ${created}, skipped ${skipped}. Catalog: ${CATALOG}`);
