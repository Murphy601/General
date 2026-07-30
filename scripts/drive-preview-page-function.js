async function pageFunction(context) {
  const { page, request, log } = context;
  const { fileId, title, grade, sourceUrl } = request.userData || {};
  const previewUrl = request.url;
  const scrollConfig = { stepPx: 500, waitMs: 600, maxLoops: 250, settleMs: 2000 };
  const maxFlips = 5;
  const nextSelectors = [
    '[aria-label="Next page"]',
    '[data-tooltip="Next page"]',
    'button[aria-label*="Next"]',
  ];

  await page.setViewport({ width: 1400, height: 900 });

  const viewerSelectors = [
    '.ndfHFb-c4YZDc-cYSp0e-s2gQvd',
    '.ndfHFb-c4YZDc-s2gQvd',
    '.ndfHFb-c4SOm-wrapper',
    '[role="document"]',
  ];

  for (const selector of viewerSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 30000 });
      break;
    } catch (error) {
      // try next selector
    }
  }

  await page.waitForTimeout(5000);

  const scrollAndAccumulate = async (config) => {
    const selectors = [
      '.ndfHFb-c4YZDc-cYSp0e-s2gQvd',
      '.ndfHFb-c4YZDc-s2gQvd',
      '.ndfHFb-c4SOm-wrapper',
      '.drive-viewer-paginated-scrollable',
    ];
    const { stepPx = 500, waitMs = 600, maxLoops = 250, settleMs = 2000 } = config || {};

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
    const pageMatch = maxText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);

    return {
      scrollStats: { loops, scrollHeight: container.scrollHeight, maxBodyLen: maxText.length },
      signInBlocked,
      pages: [{
        pageNumber: 1,
        totalPages: pageMatch ? Number(pageMatch[2]) : null,
        charCount: maxText.length,
        text: maxText,
        signInBlocked,
      }],
    };
  };

  const pages = [];
  const seen = new Set();
  let scrollStats = null;

  for (let flip = 0; flip < maxFlips; flip += 1) {
    const batch = await page.evaluate(scrollAndAccumulate, scrollConfig);
    scrollStats = batch.scrollStats;
    for (const p of batch.pages) {
      const key = p.text.slice(0, 300);
      if (!seen.has(key)) {
        seen.add(key);
        pages.push(p);
      }
    }

    const advanced = await page.evaluate((selectors) => {
      for (const selector of selectors) {
        const btn = document.querySelector(selector);
        if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
          btn.click();
          return true;
        }
      }
      return false;
    }, nextSelectors);

    if (!advanced) break;
    await page.waitForTimeout(2500);
  }

  const extractedText = pages.map((p) => p.text).filter(Boolean).join('\n\n');
  const signInBlocked = pages.some((p) => p.signInBlocked);
  const hasStrands = /strand\s*\d|sub[\s-]?strand|suggested learning experiences|key inquiry question/i.test(extractedText);

  let status = 'extracted';
  if (signInBlocked && extractedText.length < 500) status = 'blocked-sign-in';
  else if (!extractedText || extractedText.length < 80) status = 'empty';
  else if (!hasStrands && extractedText.length < 8000) status = 'partial';
  else if (extractedText.length < 300) status = 'partial';

  log.info(`Drive ${fileId}: ${status}, ${extractedText.length} chars, strands=${hasStrands}`);

  return {
    fileId: fileId || previewUrl.match(/\/d\/([^/]+)/)?.[1],
    previewUrl,
    title: title || null,
    grade: grade || null,
    sourceUrl: sourceUrl || null,
    status,
    pageCount: pages.length,
    charCount: extractedText.length,
    hasStrandContent: hasStrands,
    scrollStats,
    extractedText: extractedText.slice(0, 500000),
    pages: pages.map(({ pageNumber, totalPages, charCount, text }) => ({
      pageNumber,
      totalPages,
      charCount,
      text: text.slice(0, 100000),
    })),
  };
}
