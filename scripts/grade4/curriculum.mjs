/**
 * Grade 4 topic list for knowledge-base/phase5/curriculum-index.json, taken from the validated syllabus files.
 */
import { GRADE, GRADE_LABEL, GRADE4_SUBJECTS } from './subjects.mjs';
import { listSubStrands, loadSyllabus } from './validate.mjs';

export function topicSlug(sub) {
  const name = String(sub.name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');
  return `${sub.number.replace(/\./g, '-')}-${name}`;
}

export function grade4Topics(syllabus) {
  return listSubStrands(syllabus).map(({ strand, sub }, i) => ({
    topicNumber: sub.number,
    topicName: sub.name,
    slug: topicSlug(sub),
    topicOrder: i + 1,
    strand: `${strand.number} ${strand.name}`,
  }));
}

/** Replace Grade 4 in a curriculum index with subjects that have a validated syllabus. */
export function applyGrade4Index(index) {
  const subjects = {};
  for (const meta of GRADE4_SUBJECTS) {
    const syllabus = loadSyllabus(meta.slug);
    if (!syllabus) continue;
    subjects[meta.subject] = {
      subject: meta.subject,
      fileIds: [meta.fileId],
      source: 'kicd-grade4-syllabus',
      topics: grade4Topics(syllabus),
    };
  }
  const entry = { grade: GRADE, label: GRADE_LABEL, subjects };
  const at = index.grades.findIndex((g) => g.grade === GRADE);
  if (at === -1) index.grades.push(entry);
  else index.grades[at] = entry;
  index.totalTopics = index.grades.reduce(
    (acc, g) => acc + Object.values(g.subjects).reduce((n, s) => n + s.topics.length, 0),
    0,
  );
  return index;
}
