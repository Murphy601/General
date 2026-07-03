#!/usr/bin/env node
import "dotenv/config";
import { loadCanonicalProductList, applyUpdatesToCatalogFiles } from "./lib/catalogFiles.mjs";
import { isAmazonConfigured, extractAsin, fetchAmazonItems } from "./providers/amazon.mjs";
import {
  isAliExpressConfigured,
  extractProductId,
  fetchAliExpressItems,
} from "./providers/aliexpress.mjs";
import {
  isStructuredDataCheckEnabled,
  checkProductPage,
  sleep,
} from "./providers/structuredDataCheck.mjs";

const nowIso = () => new Date().toISOString();

async function syncAmazon(products, updates) {
  const items = products.filter((p) => p.source === "amazon");
  if (items.length === 0) return;

  if (!isAmazonConfigured()) {
    console.log(`[amazon] Skipped ${items.length} product(s) — no API credentials configured.`);
    return;
  }

  const asinById = new Map();
  for (const product of items) {
    const asin = extractAsin(product.sourceUrl);
    if (asin) asinById.set(asin, product.id);
    else console.warn(`[amazon] Could not extract ASIN from ${product.sourceUrl}`);
  }

  const results = await fetchAmazonItems([...asinById.keys()]);
  for (const [asin, data] of results) {
    const id = asinById.get(asin);
    if (!id) continue;
    updates.set(id, {
      ...(updates.get(id) || {}),
      priceUsd: data.priceUsd,
      lastChecked: nowIso(),
    });
  }
  console.log(`[amazon] Checked ${items.length}, updated ${results.size}.`);
}

async function syncAliExpress(products, updates) {
  const items = products.filter((p) => p.source === "aliexpress");
  if (items.length === 0) return;

  if (!isAliExpressConfigured()) {
    console.log(`[aliexpress] Skipped ${items.length} product(s) — no API credentials configured.`);
    return;
  }

  const idByProductId = new Map();
  for (const product of items) {
    const productId = extractProductId(product.sourceUrl);
    if (productId) idByProductId.set(productId, product.id);
    else console.warn(`[aliexpress] Could not extract product id from ${product.sourceUrl}`);
  }

  const results = await fetchAliExpressItems([...idByProductId.keys()]);
  for (const [productId, data] of results) {
    const id = idByProductId.get(productId);
    if (!id) continue;
    updates.set(id, {
      ...(updates.get(id) || {}),
      priceUsd: data.priceUsd,
      rating: data.rating,
      lastChecked: nowIso(),
    });
  }
  console.log(`[aliexpress] Checked ${items.length}, updated ${results.size}.`);
}

async function syncStructuredData(products, updates) {
  const items = products.filter((p) => ["kilimall", "jumia", "temu"].includes(p.source));
  if (items.length === 0) return;

  if (!isStructuredDataCheckEnabled()) {
    console.log(
      `[structured-data] Skipped ${items.length} product(s) (Kilimall/Jumia/Temu have no official API) — ` +
        `set ENABLE_STRUCTURED_DATA_CHECK=true to try the experimental page-check instead.`
    );
    return;
  }

  let updatedCount = 0;
  for (const product of items) {
    const result = await checkProductPage(product.sourceUrl);
    if (result) {
      const priceField = product.priceKes != null ? "priceKes" : "priceUsd";
      updates.set(product.id, {
        ...(updates.get(product.id) || {}),
        [priceField]: result.price,
        rating: result.rating,
        reviews: result.reviews,
        lastChecked: nowIso(),
      });
      updatedCount += 1;
    }
    await sleep(2000); // be a polite, low-frequency visitor
  }
  console.log(`[structured-data] Checked ${items.length}, updated ${updatedCount}.`);
}

async function main() {
  console.log(`Sokoni catalog sync starting at ${nowIso()}`);
  const products = await loadCanonicalProductList();
  const updates = new Map();

  await syncAmazon(products, updates);
  await syncAliExpress(products, updates);
  await syncStructuredData(products, updates);

  if (updates.size === 0) {
    console.log("No updates to apply. Done.");
    return;
  }

  const changedFiles = await applyUpdatesToCatalogFiles(updates);
  console.log(`Applied updates for ${updates.size} product(s) across ${changedFiles} file(s).`);
}

main().catch((err) => {
  console.error("Catalog sync failed:", err);
  process.exit(1);
});
