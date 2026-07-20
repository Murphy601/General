#!/usr/bin/env node
/**
 * Build curriculum index: all grades, subjects, strands from curriculum-text.json
 * Output: knowledge-base/phase5/curriculum-index.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listDocuments,
  inferDocSubject,
  extractStrands,
  extractSubStrands,
  formatGradeLabel,
  INDEX_PATH,
} from './curriculum-source.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GRADE_ORDER = [
  'sne/visual-impairment/pp1', 'sne/visual-impairment/pp2',
  'sne/hearing-impairment/pp1', 'sne/hearing-impairment/pp2',
  'sne/physical-impairment/pp1', 'sne/physical-impairment/pp2',
  'pre-primary', 'pp1', 'pp2',
  'lower-primary', 'grade-1', 'grade-2', 'grade-3',
  'grade-4', 'grade-5', 'grade-6',
  'grade-7', 'grade-8', 'grade-9',
  'grade-10', 'grade-11', 'grade-12',
];

function gradeSortKey(grade) {
  const idx = GRADE_ORDER.indexOf(grade);
  return idx === -1 ? 1000 + grade.charCodeAt(0) : idx;
}

const allDocs = listDocuments();
const byGrade = {};

for (const doc of allDocs) {
  const grade = doc.grade || 'unknown';
  const subject = inferDocSubject(doc);
  const strands = extractStrands(doc.extractedText || '');

  if (!byGrade[grade]) {
    byGrade[grade] = { grade, label: formatGradeLabel(grade), subjects: {} };
  }
  if (!byGrade[grade].subjects[subject]) {
    byGrade[grade].subjects[subject] = { subject, fileIds: [], strands: [], topics: [] };
  }

  const entry = byGrade[grade].subjects[subject];
  entry.fileIds.push(doc.fileId);

  for (const strand of strands) {
    const subs = extractSubStrands(doc.extractedText, strand.number);
    const topic = {
      strand: strand.name,
      strandNumber: strand.number,
      subStrands: subs.map((s) => s.name),
      fileId: doc.fileId,
    };
    entry.strands.push(strand.name);
    entry.topics.push(topic);
  }

  if (!entry.topics.length) {
    entry.topics.push({ strand: 'General', strandNumber: '0', subStrands: [], fileId: doc.fileId });
  }
}

const grades = Object.values(byGrade).sort((a, b) => gradeSortKey(a.grade) - gradeSortKey(b.grade));

let totalTopics = 0;
for (const g of grades) {
  for (const s of Object.values(g.subjects)) {
    totalTopics += s.topics.length;
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  totalDocuments: allDocs.length,
  totalGrades: grades.length,
  totalTopics,
  grades,
};

mkdirSync(dirname(INDEX_PATH), { recursive: true });
writeFileSync(INDEX_PATH, JSON.stringify(output, null, 2));
console.log(`Index: ${grades.length} grades, ${totalTopics} topics, ${allDocs.length} documents`);
console.log(`Saved: ${INDEX_PATH}`);
