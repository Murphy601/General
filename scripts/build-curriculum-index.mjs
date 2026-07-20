#!/usr/bin/env node
/**
 * Build curriculum index with full topic list per grade/subject.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  listDocuments,
  inferDocSubject,
  extractAllTopicsForDocument,
  formatGradeLabel,
  gradeSortKey,
  INDEX_PATH,
} from './curriculum-source.mjs';

const byGrade = {};

for (const doc of listDocuments()) {
  const grade = doc.grade || 'unknown';
  const subject = inferDocSubject(doc);
  const topics = extractAllTopicsForDocument(doc);

  if (!byGrade[grade]) {
    byGrade[grade] = { grade, label: formatGradeLabel(grade), subjects: {} };
  }
  if (!byGrade[grade].subjects[subject]) {
    byGrade[grade].subjects[subject] = { subject, fileIds: [], topics: [] };
  }

  const entry = byGrade[grade].subjects[subject];
  entry.fileIds.push(doc.fileId);
  entry.topics.push(...topics);
}

for (const g of Object.values(byGrade)) {
  for (const s of Object.values(g.subjects)) {
    // Keep index lean for git/web — raw curriculum text is reloaded from curriculum-text.json when generating
    s.topics = s.topics.map(({ rawText, ...rest }) => rest);
    s.topics.sort((a, b) => a.topicOrder - b.topicOrder);
    s.topics.forEach((t, i) => { t.topicOrder = i + 1; });
  }
}

const grades = Object.values(byGrade).sort((a, b) => gradeSortKey(a.grade) - gradeSortKey(b.grade));
let totalTopics = 0;
for (const g of grades) {
  for (const s of Object.values(g.subjects)) totalTopics += s.topics.length;
}

const output = {
  generatedAt: new Date().toISOString(),
  version: 2,
  totalDocuments: listDocuments().length,
  totalGrades: grades.length,
  totalTopics,
  grades,
};

mkdirSync(dirname(INDEX_PATH), { recursive: true });
writeFileSync(INDEX_PATH, JSON.stringify(output, null, 2));
console.log(`Index v2: ${grades.length} grades, ${totalTopics} topics`);
