import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The two JSON files that hold product data today. They intentionally have
// slightly different shapes (the website file has display-only fields like
// `emoji`, the bot file has search-only fields like `tags`/`subcategory`),
// so we update each one by matching on `id` and only touching the fields
// that actually exist in that file, rather than overwriting the whole record.
export const CATALOG_FILES = [
  path.join(__dirname, "..", "..", "src", "data", "products.json"),
  path.join(__dirname, "..", "..", "..", "website", "data", "products.json"),
];

export async function loadCanonicalProductList() {
  const raw = await readFile(CATALOG_FILES[0], "utf-8");
  return JSON.parse(raw);
}

/**
 * `updatesById`: Map<productId, { priceKes?, priceUsd?, originalPriceKes?,
 *   rating?, reviews?, lastChecked, checkStatus }>
 *
 * Applies whichever of those fields already exist as keys on each record in
 * each catalog file, leaving everything else untouched. Returns the number
 * of records actually modified (so the caller/CI job can decide whether
 * there's anything worth committing).
 */
export async function applyUpdatesToCatalogFiles(updatesById) {
  let changedCount = 0;

  for (const filePath of CATALOG_FILES) {
    const raw = await readFile(filePath, "utf-8");
    const products = JSON.parse(raw);
    let fileChanged = false;

    for (const product of products) {
      const update = updatesById.get(product.id);
      if (!update) continue;

      for (const [key, value] of Object.entries(update)) {
        if (value === undefined) continue;
        if (key === "priceKes" || key === "priceUsd" || key === "originalPriceKes") {
          // Only overwrite price fields the record already tracks, so we
          // don't e.g. add a KES price to a USD-only international item.
          if (!(key in product)) continue;
        }
        if (product[key] !== value) {
          product[key] = value;
          fileChanged = true;
        }
      }
    }

    if (fileChanged) {
      await writeFile(filePath, JSON.stringify(products, null, 2) + "\n", "utf-8");
      changedCount += 1;
    }
  }

  return changedCount;
}
