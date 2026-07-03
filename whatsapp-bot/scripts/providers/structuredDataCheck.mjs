import * as cheerio from "cheerio";

/**
 * EXPERIMENTAL / OPT-IN — for sources with no official affiliate API
 * (Kilimall, Jumia, Temu). This does NOT scrape their whole catalog or
 * discover new products; it only re-visits product pages *you've already
 * chosen to feature* and reads the same public "structured data" markup
 * (schema.org Product/Offer JSON-LD, or basic Open Graph price meta tags)
 * that a site *could* publish for Google/search engines to show price in
 * search results.
 *
 * TESTED REALITY (checked live against real product pages while building
 * this): Jumia's and Kilimall's product pages render their actual price via
 * client-side JavaScript after load — a plain server-side fetch (what this
 * script does) only sees the initial HTML shell and does NOT get the real
 * price for the main product on the page. This function will mostly return
 * null for those two today. Getting the real number would require running
 * a full headless browser (e.g. Playwright/Puppeteer) to let the page's JS
 * execute first — much heavier, slower, more fragile, and closer to the
 * kind of automated access most sites' Terms of Service restrict. That's a
 * deliberate line this starter kit doesn't cross automatically; if you want
 * to go there, do it as an explicit, separate decision, not a silent default.
 *
 * This is OFF by default and left in place because: (a) it may work fine
 * for other sources you add later, (b) these sites' templates could change
 * to embed real structured data, and (c) it doesn't hurt to have it wired
 * up and ready. Before enabling it:
 *   - Check the target site's Terms of Service / robots.txt yourself.
 *   - Keep the request rate low (this script already waits between
 *     requests) and the frequency to once/day.
 *   - Treat any result as "best effort" — verify manually before trusting it.
 *
 * Enable with: ENABLE_STRUCTURED_DATA_CHECK=true
 */

export function isStructuredDataCheckEnabled() {
  return process.env.ENABLE_STRUCTURED_DATA_CHECK === "true";
}

function extractFromJsonLd($) {
  const blocks = $('script[type="application/ld+json"]');
  for (const el of blocks.toArray()) {
    try {
      const parsed = JSON.parse($(el).contents().text());
      const candidates = Array.isArray(parsed) ? parsed : [parsed, ...(parsed["@graph"] || [])];
      for (const node of candidates) {
        if (!node) continue;
        const type = node["@type"];
        const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
        if (!isProduct) continue;

        const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
        const price = offer?.price ?? offer?.lowPrice;
        const rating = node.aggregateRating?.ratingValue;
        const reviews = node.aggregateRating?.reviewCount ?? node.aggregateRating?.ratingCount;

        if (price != null) {
          return {
            price: Number(price),
            rating: rating != null ? Number(rating) : undefined,
            reviews: reviews != null ? Number(reviews) : undefined,
          };
        }
      }
    } catch {
      // Not valid/relevant JSON-LD on this page — keep looking.
    }
  }
  return null;
}

function extractFromMetaTags($) {
  const price =
    $('meta[property="product:price:amount"]').attr("content") ||
    $('meta[property="og:price:amount"]').attr("content");
  if (!price) return null;
  return { price: Number(price) };
}

/**
 * Fetches one product page and returns { price, rating, reviews } if it can
 * find structured data, or null if it can't (page changed, blocked, etc.).
 */
export async function checkProductPage(url) {
  if (!isStructuredDataCheckEnabled()) return null;

  try {
    const response = await fetch(url, {
      headers: {
        // A normal browser user-agent — this is a legitimate single-page
        // fetch of a page you already link to, not bulk crawling.
        "User-Agent":
          "Mozilla/5.0 (compatible; SokoniCatalogSync/1.0; +https://github.com/)",
      },
    });
    if (!response.ok) {
      console.warn(`[structured-data] ${url} returned ${response.status}`);
      return null;
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    return extractFromJsonLd($) || extractFromMetaTags($);
  } catch (err) {
    console.warn(`[structured-data] Failed to check ${url}: ${err.message}`);
    return null;
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
