async function pageFunction(context) {
  const { page, request, log } = context;
  const { fileId, title, grade, sourceUrl } = request.userData || {};
  const previewUrl = request.url;
  const maxPages = 10;
  const waitMs = 2500;

  await page.setViewport({ width: 1400, height: 900 });

  const viewerSelectors = [
    '.ndfHFb-c4SOm-wrapper',
    '.drive-viewer-paginated-scrollable',
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

  const pages = [];
  const seenHashes = new Set();

  for (let i = 0; i < maxPages; i += 1) {
    const snapshot = await page.evaluate(() => {
      const signInBlocked = /sign in/i.test(document.body.innerText) &&
        !!document.querySelector('a[href*="accounts.google.com"]');
      const layerText = [...document.querySelectorAll('.textLayer, motion-page-content, [data-page-index]')]
        .map((el) => el.innerText.trim())
        .filter(Boolean)
        .join('\n');
      const spanText = [...document.querySelectorAll('.textLayer span, motion-text-track span, .sketchyTextContent span')]
        .map((s) => s.textContent.trim())
        .filter(Boolean)
        .join(' ');
      const docText = document.querySelector('[role="document"]')?.innerText?.trim() || '';
      const bodyText = document.body.innerText.trim();
      const text = [layerText, spanText, docText, bodyText].find((t) => t.length > 80) || bodyText;
      const docTitle = document.title.replace(/ - Google Drive$/, '').trim();
      const pageMatch = bodyText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
      return {
        signInBlocked,
        title: docTitle,
        text,
        currentPage: pageMatch ? Number(pageMatch[1]) : null,
        totalPages: pageMatch ? Number(pageMatch[2]) : null,
        charCount: text.length,
      };
    });

    const hash = snapshot.text.slice(0, 200);
    if (seenHashes.has(hash)) break;
    seenHashes.add(hash);

    pages.push({
      pageNumber: snapshot.currentPage || i + 1,
      totalPages: snapshot.totalPages,
      charCount: snapshot.charCount,
      text: snapshot.text,
      signInBlocked: snapshot.signInBlocked,
    });

    if (snapshot.signInBlocked) break;

    const advanced = await page.evaluate(() => {
      const selectors = [
        '[aria-label="Next page"]',
        '[data-tooltip="Next page"]',
        'button[aria-label*="Next"]',
      ];
      for (const selector of selectors) {
        const btn = document.querySelector(selector);
        if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (!advanced) break;
    await page.waitForTimeout(waitMs);
  }

  const signInBlocked = pages.some((p) => p.signInBlocked);
  const extractedText = pages.map((p) => p.text).filter(Boolean).join('\n\n');
  let status = 'extracted';
  if (signInBlocked) status = 'blocked-sign-in';
  else if (!extractedText || extractedText.length < 80) status = 'empty';
  else if (extractedText.length < 300) status = 'partial';

  let screenshotUrl = null;
  if (status === 'empty' || status === 'blocked-sign-in') {
    const shot = await page.screenshot({ fullPage: false, type: 'png' });
    screenshotUrl = `data:image/png;base64,${shot.toString('base64').slice(0, 200)}...[truncated]`;
  }

  log.info(`Drive ${fileId}: ${status}, ${pages.length} pages, ${extractedText.length} chars`);

  return {
    fileId: fileId || previewUrl.match(/\/d\/([^/]+)/)?.[1],
    previewUrl,
    title: title || pages[0]?.text?.match(/^[^\n]+/)?.[0] || null,
    grade: grade || null,
    sourceUrl: sourceUrl || null,
    status,
    pageCount: pages.length,
    charCount: extractedText.length,
    extractedText: extractedText.slice(0, 500000),
    pages: pages.map(({ pageNumber, totalPages, charCount, text }) => ({
      pageNumber,
      totalPages,
      charCount,
      text: text.slice(0, 100000),
    })),
    screenshotCaptured: !!screenshotUrl,
  };
}
