import { getGrades, getSubjects, getTopics, slugifySubject } from './content-store';

const REVISION_CATEGORIES = ['general', 'termly', 'mock', 'premium', 'vault'];

export function learnGradeParams() {
  return getGrades().map((g) => ({ grade: g.grade }));
}

export function learnSubjectParams() {
  return getGrades().flatMap((g) =>
    getSubjects(g.grade).map((s) => ({ grade: g.grade, subject: slugifySubject(s.subject) })),
  );
}

export function learnTopicParams() {
  return getGrades().flatMap((g) =>
    getSubjects(g.grade).flatMap((s) =>
      getTopics(g.grade, s.subject)
        .filter((t) => t.contentId && t.slug)
        .map((t) => ({ grade: g.grade, subject: slugifySubject(s.subject), topic: t.slug! })),
    ),
  );
}

export function revisionCategoryParams() {
  return REVISION_CATEGORIES.map((category) => ({ category }));
}

export function revisionGradeParams() {
  return REVISION_CATEGORIES.flatMap((category) =>
    getGrades().map((g) => ({ category, grade: g.grade })),
  );
}

export function revisionSubjectParams() {
  return REVISION_CATEGORIES.filter((category) => category !== 'vault').flatMap((category) =>
    getGrades().flatMap((g) =>
      getSubjects(g.grade).map((s) => ({
        category,
        grade: g.grade,
        subject: slugifySubject(s.subject),
      })),
    ),
  );
}
