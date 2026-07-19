/**
 * Google Drive preview DOM text extraction helpers.
 * Used by local Playwright and Apify web-scraper page functions.
 */

export const DRIVE_VIEWER_SELECTORS = [
  '.ndfHFb-c4SOm-wrapper',
  '.drive-viewer-paginated-scrollable',
  '[role="document"]',
  '.ndfHFb-c4SOme-LS81yb',
];

export const DRIVE_NEXT_PAGE_SELECTORS = [
  '[aria-label="Next page"]',
  '[data-tooltip="Next page"]',
  'button[aria-label*="Next"]',
];

export function toPreviewUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function toViewUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Browser-side extraction function (stringified for Apify pageFunction).
 */
export const EXTRACT_PAGE_TEXT_FN = `() => {
  const signInBlocked = /sign in/i.test(document.body.innerText) &&
    !!document.querySelector('a[href*="accounts.google.com"]');
  const layerText = [...document.querySelectorAll('.textLayer, motion-page-content, [data-page-index]')]
    .map((el) => el.innerText.trim())
    .filter(Boolean)
    .join('\\n');
  const spanText = [...document.querySelectorAll('.textLayer span, motion-text-track span, .sketchyTextContent span')]
    .map((s) => s.textContent.trim())
    .filter(Boolean)
    .join(' ');
  const docText = document.querySelector('[role="document"]')?.innerText?.trim() || '';
  const bodyText = document.body.innerText.trim();
  const text = [layerText, spanText, docText, bodyText].find((t) => t.length > 80) || bodyText;
  const title = document.title.replace(/ - Google Drive$/, '').trim();
  const pageMatch = bodyText.match(/Page\\s+(\\d+)\\s+of\\s+(\\d+)/i);
  return {
    signInBlocked,
    title,
    text,
    currentPage: pageMatch ? Number(pageMatch[1]) : null,
    totalPages: pageMatch ? Number(pageMatch[2]) : null,
    charCount: text.length,
  };
}`;

export const CLICK_NEXT_PAGE_FN = `() => {
  const selectors = ${JSON.stringify(DRIVE_NEXT_PAGE_SELECTORS)};
  for (const selector of selectors) {
    const btn = document.querySelector(selector);
    if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
      btn.click();
      return true;
    }
  }
  return false;
}`;

export function normalizeDriveDocument({
  fileId,
  previewUrl,
  title,
  grade,
  subject,
  sourceUrl,
  pages,
  status,
  error = null,
}) {
  const extractedText = pages.map((p) => p.text).filter(Boolean).join('\n\n');
  return {
    fileId,
    previewUrl,
    title: title || null,
    grade: grade || null,
    subject: subject || null,
    sourceUrl: sourceUrl || null,
    status,
    error,
    pageCount: pages.length,
    totalPagesDetected: pages.find((p) => p.totalPages)?.totalPages ?? null,
    charCount: extractedText.length,
    extractedText,
    pages,
  };
}

export function classifyExtractionStatus(pages, signInBlocked) {
  const text = pages.map((p) => p.text).join('');
  const hasCurriculumContent = /curriculum design|foreword|kicd|grade\s*\d|republique of kenya/i.test(text);

  if (signInBlocked && !hasCurriculumContent && text.length < 500) {
    return 'blocked-sign-in';
  }
  if (!text || text.length < 80) return 'empty';
  if (text.length < 300) return 'partial';
  return 'extracted';
}
