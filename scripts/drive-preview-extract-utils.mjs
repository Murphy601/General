/**
 * Google Drive preview DOM text extraction helpers.
 * Used by local Playwright and Apify web-scraper page functions.
 */

export const DRIVE_VIEWER_SELECTORS = [
  '.ndfHFb-c4YZDc-cYSp0e-s2gQvd',
  '.ndfHFb-c4YZDc-s2gQvd',
  '.ndfHFb-c4SOm-wrapper',
  '.drive-viewer-paginated-scrollable',
  '[role="document"]',
];

export const DRIVE_SCROLL_CONTAINER_SELECTORS = [
  '.ndfHFb-c4YZDc-cYSp0e-s2gQvd',
  '.ndfHFb-c4YZDc-s2gQvd',
  '.ndfHFb-c4SOm-wrapper',
  '.drive-viewer-paginated-scrollable',
  '.scrollableRegion',
];

export const DRIVE_NEXT_PAGE_SELECTORS = [
  '[aria-label="Next page"]',
  '[data-tooltip="Next page"]',
  'button[aria-label*="Next"]',
];

export const SCROLL_CONFIG = {
  stepPx: 500,
  waitMs: 600,
  maxLoops: 250,
  settleMs: 2000,
};

export function toPreviewUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function toViewUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Browser-side: scroll Drive preview and accumulate lazy-loaded body text.
 */
export const SCROLL_AND_ACCUMULATE_TEXT_FN = `async (config) => {
  const {
    stepPx = 500,
    waitMs = 600,
    maxLoops = 250,
    settleMs = 2000,
    containerSelectors = [],
  } = config || {};

  const selectors = containerSelectors.length ? containerSelectors : [
    '.ndfHFb-c4YZDc-cYSp0e-s2gQvd',
    '.ndfHFb-c4YZDc-s2gQvd',
    '.ndfHFb-c4SOm-wrapper',
    '.drive-viewer-paginated-scrollable',
  ];

  let container = null;
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && el.scrollHeight > el.clientHeight + 20) {
      container = el;
      break;
    }
  }
  if (!container) {
    container = [...document.querySelectorAll('motion-viewer, div')].find(
      (el) => el.scrollHeight > el.clientHeight + 50,
    ) || document.scrollingElement || document.documentElement;
  }

  let loops = 0;
  let maxText = document.body.innerText.trim();
  let lastTop = -1;

  for (let i = 0; i < maxLoops; i += 1) {
    loops = i + 1;
    container.scrollTop += stepPx;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    const current = document.body.innerText.trim();
    if (current.length > maxText.length) maxText = current;
    const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 10;
    if (atBottom && container.scrollTop === lastTop) break;
    lastTop = container.scrollTop;
  }

  await new Promise((resolve) => setTimeout(resolve, settleMs));
  const finalText = document.body.innerText.trim();
  if (finalText.length > maxText.length) maxText = finalText;

  const signInBlocked = /sign in/i.test(maxText) &&
    !!document.querySelector('a[href*="accounts.google.com"]');
  const pageMatch = maxText.match(/Page\\s+(\\d+)\\s+of\\s+(\\d+)/i);

  return {
    scrollStats: {
      loops,
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight,
      maxBodyLen: maxText.length,
    },
    signInBlocked,
    pages: [{
      pageNumber: 1,
      totalPages: pageMatch ? Number(pageMatch[2]) : null,
      charCount: maxText.length,
      text: maxText,
      signInBlocked,
    }],
    mode: 'body-scroll',
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

/** Playwright helper: scroll viewer and accumulate lazy-loaded body text. */
export async function scrollAndCollectDriveText(page, config = SCROLL_CONFIG) {
  return page.evaluate(
    async ({ fn, config: scrollConfig, containerSelectors }) => {
      // eslint-disable-next-line no-eval
      return eval(`(${fn})`)({ ...scrollConfig, containerSelectors });
    },
    {
      fn: SCROLL_AND_ACCUMULATE_TEXT_FN,
      config,
      containerSelectors: DRIVE_SCROLL_CONTAINER_SELECTORS,
    },
  );
}

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
  scrollStats = null,
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
    scrollStats,
  };
}

export function classifyExtractionStatus(pages, signInBlocked) {
  const text = pages.map((p) => p.text).join('');
  const hasCurriculumContent = /curriculum design|foreword|kicd|grade\s*\d|republique of kenya|strand|sub[\s-]?strand|learning outcome/i.test(text);

  if (signInBlocked && !hasCurriculumContent && text.length < 500) {
    return 'blocked-sign-in';
  }
  if (!text || text.length < 80) return 'empty';
  if (text.length < 300) return 'partial';
  return 'extracted';
}

export function hasStrandContent(text) {
  return /strand\s*\d|sub[\s-]?strand|suggested learning experiences|key inquiry question|specific learning outcomes/i.test(text);
}
