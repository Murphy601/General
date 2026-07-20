/**
 * Chunking helpers for CBC curriculum text RAG.
 */

const CURRICULUM_KEYWORDS = /curriculum design|foreword|preface|strand|sub[\s-]?strand|learning outcome|kicd|competenc/i;

const SUBJECT_PATTERNS = [
  /PRIMARY SCHOOL CURRICULUM DESIGN\s*\n+([A-Z][A-Z\s/&-]+)\s*\n+GRADE/i,
  /SENIOR SCHOOL CURRICULUM DESIGN\s*\n+GRADE\s*\d+\s*\n+([A-Z][A-Z\s/&-]+)/i,
  /CURRICULUM DESIGN\s*\n+([A-Z][A-Z\s/&-]+)\s*\n+GRADE/i,
  /JUNIOR SCHOOL CURRICULUM DESIGN\s*\n+([A-Z][A-Z\s/&-]+)/i,
];

export function inferSubject(text, title) {
  const sample = `${title || ''}\n${text.slice(0, 3000)}`;
  if (/KISWAHILI|MTAALA WA KISWAHILI|GREDI YA/i.test(sample)) return 'KISWAHILI';
  if (/CHRISTIAN RELIGIOUS EDUCATION|\bCRE\b/i.test(sample)) return 'CHRISTIAN RELIGIOUS EDUCATION';
  if (/ISLAMIC RELIGIOUS EDUCATION|\bIRE\b/i.test(sample)) return 'ISLAMIC RELIGIOUS EDUCATION';
  if (/HINDU RELIGIOUS EDUCATION|\bHRE\b/i.test(sample)) return 'HINDU RELIGIOUS EDUCATION';
  if (/LANGUAGE ACTIVITIES/i.test(sample) && /PRE[\s-]?PRIMARY/i.test(sample)) return 'LANGUAGE ACTIVITIES';
  if (/MATHEMATICS ACTIVITIES/i.test(sample) && /PRE[\s-]?PRIMARY|LOWER PRIMARY|GRADE ONE|GREDI/i.test(sample)) {
    return 'MATHEMATICS ACTIVITIES';
  }
  if (/ENVIRONMENTAL ACTIVITIES/i.test(sample)) return 'ENVIRONMENTAL ACTIVITIES';
  if (/PSYCHOMOTOR AND CREATIVE|CREATIVE ACTIVITIES/i.test(sample)) return 'CREATIVE ACTIVITIES';
  if (/HYGIENE AND NUTRITION/i.test(sample)) return 'HYGIENE AND NUTRITION ACTIVITIES';
  if (/LITERACY ACTIVITIES/i.test(sample)) return 'LITERACY ACTIVITIES';
  if (/ENGLISH ACTIVITIES/i.test(sample)) return 'ENGLISH ACTIVITIES';
  for (const pattern of SUBJECT_PATTERNS) {
    const match = sample.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, ' ').trim();
  }
  const gradeLine = sample.match(/\b([A-Z][A-Z\s/&-]{2,40})\s*\n+GRADE\s+(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE)/i);
  if (gradeLine?.[1] && !/CURRICULUM|DESIGN|KENYA|INSTITUTE/i.test(gradeLine[1])) {
    return gradeLine[1].replace(/\s+/g, ' ').trim();
  }
  return null;
}

export function normalizeGrade(grade) {
  if (!grade) return null;
  return grade.replace(/^regular\//, '').replace(/\//g, '/');
}

export function isUsableDocument(doc) {
  if (!doc?.extractedText || doc.extractedText.length < 80) return false;
  if (doc.status === 'empty' || doc.status === 'error') return false;
  if (doc.status === 'blocked-sign-in' && !CURRICULUM_KEYWORDS.test(doc.extractedText)) return false;
  return true;
}

export function splitParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 20);
}

export function chunkText(text, { maxChars = 1200, overlap = 150 } = {}) {
  const paragraphs = splitParagraphs(text);
  if (!paragraphs.length) return [];

  const chunks = [];
  let current = '';

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed.length >= 80) chunks.push(trimmed);
    current = '';
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      flush();
      let start = 0;
      while (start < paragraph.length) {
        const end = Math.min(start + maxChars, paragraph.length);
        chunks.push(paragraph.slice(start, end).trim());
        if (end >= paragraph.length) break;
        start = Math.max(end - overlap, start + 1);
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      flush();
      current = paragraph;
    }
  }
  flush();

  if (chunks.length <= 1) return chunks;

  const overlapped = [chunks[0]];
  for (let i = 1; i < chunks.length; i += 1) {
    const prev = overlapped[overlapped.length - 1];
    const tail = prev.slice(-overlap);
    overlapped.push(`${tail}\n\n${chunks[i]}`.trim());
  }
  return overlapped;
}

export function chunkDocument(doc, options = {}) {
  if (!isUsableDocument(doc)) return [];

  const subject = doc.subject || inferSubject(doc.extractedText, doc.title);
  const grade = normalizeGrade(doc.grade);
  const textChunks = chunkText(doc.extractedText, options);

  return textChunks.map((text, index) => ({
    id: `${doc.fileId}::${index}`,
    fileId: doc.fileId,
    chunkIndex: index,
    chunkCount: textChunks.length,
    source: 'kicd-curriculum',
    sourceUrl: doc.sourceUrl || null,
    previewUrl: doc.previewUrl || null,
    grade,
    subject,
    title: doc.title || null,
    status: doc.status,
    charCount: text.length,
    text,
  }));
}

export function chunkCurriculumDocuments(documents, options = {}) {
  const chunks = [];
  for (const doc of documents) {
    chunks.push(...chunkDocument(doc, options));
  }
  return chunks;
}
