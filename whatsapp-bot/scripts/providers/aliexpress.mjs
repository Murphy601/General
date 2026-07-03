import crypto from "node:crypto";

/**
 * AliExpress Affiliate API client using the standard "TOP" (Taobao Open
 * Platform) request-signing scheme that AliExpress's affiliate/open
 * platform APIs use.
 *
 * IMPORTANT: joining the AliExpress Affiliate Program (the link-generator
 * portal at portals.aliexpress.com) does NOT automatically give you these
 * API credentials. You need to additionally register a developer app at
 * https://open.aliexpress.com/ (under the same affiliate account) to get
 * an App Key + App Secret. This is a common source of confusion — most
 * affiliates only ever use the manual link-generator UI. Treat this
 * provider as "available once you've done that extra step," not day-one.
 *
 * Requires:
 *   ALIEXPRESS_APP_KEY
 *   ALIEXPRESS_APP_SECRET
 *   ALIEXPRESS_TRACKING_ID  (your affiliate tracking id, aka PID)
 *
 * Docs: https://developers.aliexpress.com/en/doc.htm
 */

const API_URL = "https://api-sg.aliexpress.com/sync";
const METHOD = "aliexpress.affiliate.productdetail.get";

export function isAliExpressConfigured() {
  return Boolean(
    process.env.ALIEXPRESS_APP_KEY &&
      process.env.ALIEXPRESS_APP_SECRET &&
      process.env.ALIEXPRESS_TRACKING_ID
  );
}

/** Pulls the numeric product id out of a normal AliExpress item URL. */
export function extractProductId(url) {
  const match = url.match(/\/item\/(?:.*-)?(\d+)\.html/) || url.match(/\/(\d{6,})\.html/);
  return match ? match[1] : null;
}

function signParams(params, appSecret) {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  return crypto
    .createHash("md5")
    .update(appSecret + sorted + appSecret, "utf8")
    .digest("hex")
    .toUpperCase();
}

/**
 * Fetches current price + rating info for a batch of AliExpress product ids.
 * Returns a map of productId -> { priceUsd, rating, reviews }.
 */
export async function fetchAliExpressItems(productIds) {
  if (!isAliExpressConfigured()) {
    console.warn(
      "[aliexpress] Skipping — ALIEXPRESS_APP_KEY/APP_SECRET/TRACKING_ID not set (see comment in scripts/providers/aliexpress.mjs)."
    );
    return new Map();
  }
  if (productIds.length === 0) return new Map();

  const timestamp = Date.now().toString();
  const baseParams = {
    app_key: process.env.ALIEXPRESS_APP_KEY,
    method: METHOD,
    timestamp,
    sign_method: "md5",
    v: "2.0",
    format: "json",
    product_ids: productIds.join(","),
    tracking_id: process.env.ALIEXPRESS_TRACKING_ID,
    target_currency: "USD",
    target_language: "EN",
  };

  const sign = signParams(baseParams, process.env.ALIEXPRESS_APP_SECRET);
  const query = new URLSearchParams({ ...baseParams, sign }).toString();

  try {
    const response = await fetch(`${API_URL}?${query}`);
    if (!response.ok) {
      console.warn(`[aliexpress] API returned ${response.status}: ${await response.text()}`);
      return new Map();
    }

    const data = await response.json();
    const items =
      data?.aliexpress_affiliate_productdetail_get_response?.resp_result?.result?.products
        ?.product || [];

    const results = new Map();
    for (const item of items) {
      results.set(String(item.product_id), {
        priceUsd: Number(item.target_sale_price ?? item.sale_price),
        rating: item.evaluate_rate ? Number(item.evaluate_rate.replace("%", "")) / 20 : undefined,
      });
    }
    return results;
  } catch (err) {
    console.warn(`[aliexpress] Fetch failed: ${err.message}`);
    return new Map();
  }
}
