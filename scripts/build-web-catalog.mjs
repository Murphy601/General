#!/usr/bin/env node
/**
 * Build a lightweight catalog for the web app from curriculum-text.json.
 * Output: web/public/data/catalog.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = join(__dirname, '..', 'knowledge-base', 'phase3', 'curriculum-text.json');
const OUTPUT = join(__dirname, '..', 'web', 'public', 'data', 'catalog.json');

if (!existsSync(INPUT)) {
  console.log(`Skip web:catalog — ${INPUT} not found (Learning Docs still works from web/data/content).`);
  process.exit(0);
}

function slugify(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function inferSubject(doc) {
  if (doc.subject) return doc.subject;
  const text = doc.extractedText || '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 30)) {
    if (line.length > 4 && line.length < 80 && /^[A-Z][A-Z\s&,'()-]+$/.test(line)) {
      if (!line.includes('CURRICULUM') && !line.includes('KENYA') && !line.includes('PAGE')) {
        return line;
      }
    }
  }
  return doc.title && doc.title !== 'Page' ? doc.title : 'General';
}

function formatGradeLabel(grade) {
  if (!grade) return 'Unknown';
  return grade
    .replace(/^sne\//, 'SNE / ')
    .replace(/\//g, ' / ')
    .replace(/grade-/g, 'Grade ')
    .replace(/grade-/g, 'Grade ')
    .replace(/\bpp(\d)\b/gi, 'PP$1')
    .replace(/\b(\w)/g, (m, c, i) => (i === 0 || grade[i - 1] === ' ' ? c.toUpperCase() : m));
}

const catalog = JSON.parse(readFileSync(INPUT, 'utf8'));
const documents = (catalog.documents || [])
  .filter((d) => d.status === 'extracted' && (d.charCount || 0) > 500)
  .map((doc) => {
    const subject = inferSubject(doc);
    return {
      fileId: doc.fileId,
      title: doc.title && doc.title !== 'Page' ? doc.title : subject,
      subject,
      subjectSlug: slugify(subject),
      grade: doc.grade || 'unknown',
      gradeLabel: formatGradeLabel(doc.grade),
      gradeSlug: slugify(doc.grade),
      previewUrl: doc.previewUrl,
      sourceUrl: doc.sourceUrl,
      charCount: doc.charCount || 0,
      pageCount: doc.pageCount || doc.totalPagesDetected || 1,
      excerpt: (doc.extractedText || '').slice(0, 400).replace(/\s+/g, ' ').trim(),
    };
  });

const byGrade = {};
const bySubject = {};
for (const doc of documents) {
  if (!byGrade[doc.grade]) {
    byGrade[doc.grade] = { slug: doc.gradeSlug, label: doc.gradeLabel, subjects: {}, count: 0 };
  }
  byGrade[doc.grade].count += 1;
  if (!byGrade[doc.grade].subjects[doc.subject]) {
    byGrade[doc.grade].subjects[doc.subject] = { slug: doc.subjectSlug, count: 0, documents: [] };
  }
  byGrade[doc.grade].subjects[doc.subject].count += 1;
  byGrade[doc.grade].subjects[doc.subject].documents.push(doc.fileId);

  bySubject[doc.subject] = (bySubject[doc.subject] || 0) + 1;
}

const output = {
  generatedAt: new Date().toISOString(),
  totalDocuments: documents.length,
  documents,
  byGrade,
  bySubject,
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(output));
console.log(`Catalog: ${documents.length} documents -> ${OUTPUT}`);
