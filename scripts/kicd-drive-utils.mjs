/**
 * Shared helpers for Google Drive link extraction and KICD PDF paths.
 */

const DRIVE_FILE_ID_RE = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=download&)?id=)([a-zA-Z0-9_-]+)/;
const DRIVE_FILE_ID_GLOBAL_RE = /drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/g;
const DRIVE_META_RE = /\{"id":\s*"([^"]+)",\s*"title":\s*"([^"]+)",\s*"mimeType":\s*"application\\\/pdf"\}/g;

const GRADE_WORD_MAP = {
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
};

export function extractFileId(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(DRIVE_FILE_ID_RE);
  return match ? match[1] : null;
}

export function extractAllFileIds(text) {
  if (!text) return [];
  const ids = new Set();
  for (const match of text.matchAll(DRIVE_FILE_ID_GLOBAL_RE)) {
    ids.add(match[1]);
  }
  return [...ids];
}

export function extractPdfMeta(text) {
  if (!text) return [];
  const results = [];
  for (const match of text.matchAll(DRIVE_META_RE)) {
    results.push({
      fileId: match[1].replace(/\\_/g, '_'),
      title: match[2].replace(/\\"/g, '"'),
    });
  }
  return results;
}

export function toDirectDownloadUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export function sanitizeFilename(name, fallback = 'document.pdf') {
  const base = (name || fallback)
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base) return fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

export function sourceUrlToPdfFolder(sourceUrl) {
  const url = new URL(sourceUrl);
  const path = url.pathname.replace(/\/$/, '');

  const sneMatch = path.match(/\/sne-curriculum-designs\/(hi|pi|vi)-([^/]+)/);
  if (sneMatch) {
    const typeMap = { hi: 'hearing-impairment', pi: 'physical-impairment', vi: 'visual-impairment' };
    const grade = normalizeSneGrade(sneMatch[2]);
    return `sne/${typeMap[sneMatch[1]]}/${grade}`;
  }

  const regular = path.match(/\/curriculum-designs\/grade-(four|five|six|seven|eight|nine|ten|eleven|twelve)/);
  if (regular) return `grade-${GRADE_WORD_MAP[regular[1]]}`;

  if (path.includes('/pre-primary')) return 'pre-primary';
  if (path.includes('/lower-primary')) return 'lower-primary';
  if (path.includes('/prevocational')) return 'sne/prevocational';
  if (path.includes('/vocational-level')) return 'sne/vocational';
  if (path.includes('/curriculum-designs')) return 'curriculum-designs';

  return 'general';
}

function normalizeSneGrade(slug) {
  if (slug.includes('pp1')) return 'pp1';
  if (slug.includes('pp2')) return 'pp2';
  if (slug === 'grade-8' || slug === 'grade-9' || slug === 'grade-10') return slug;
  if (slug.includes('grade-one')) return 'grade-one';
  if (slug.includes('grade-two')) return 'grade-two';
  if (slug.includes('grade-three')) return 'grade-three';
  if (slug.includes('grade-four')) return 'grade-four';
  if (slug.includes('grade-five')) return 'grade-five';
  if (slug.includes('grade-six')) return 'grade-six';
  if (slug.includes('grade-seven')) return 'grade-seven';
  return slug;
}

export function collectDriveLinksFromItem(item) {
  const sourceUrl = item.url || item.loadedUrl || '';
  const chunks = [
    item.markdown,
    item.html,
    item.text,
    ...(item.driveLinks || []),
    ...(item.pdfMeta || []).map((meta) => meta.fileId),
  ].filter(Boolean);

  const text = chunks.join('\n');
  const fileIds = new Set(extractAllFileIds(text));
  for (const link of item.driveLinks || []) {
    const id = extractFileId(link);
    if (id) fileIds.add(id);
  }
  for (const meta of item.pdfMeta || []) {
    if (meta.fileId) fileIds.add(meta.fileId);
  }

  const titleById = new Map();
  for (const meta of extractPdfMeta(text)) {
    titleById.set(meta.fileId, meta.title);
  }
  for (const meta of item.pdfMeta || []) {
    if (meta.fileId) titleById.set(meta.fileId, meta.title);
  }

  return [...fileIds].map((fileId) => ({
    fileId,
    title: titleById.get(fileId) || null,
    previewUrl: `https://drive.google.com/file/d/${fileId}/view`,
    downloadUrl: toDirectDownloadUrl(fileId),
    sourceUrl,
    folder: sourceUrlToPdfFolder(sourceUrl),
  }));
}
