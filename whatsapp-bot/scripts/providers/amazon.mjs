import crypto from "node:crypto";

/**
 * Amazon Product Advertising API v5 (PA-API 5) client — official, sanctioned
 * way to fetch live price/availability for products you're an Associate for.
 *
 * Requires (set as env vars / GitHub Action secrets):
 *   AMAZON_ACCESS_KEY   — from your Associates "Product Advertising API" credentials
 *   AMAZON_SECRET_KEY
 *   AMAZON_PARTNER_TAG  — your Associates tracking tag (same as AMAZON_AFFILIATE_TAG)
 *   AMAZON_HOST (optional, default "webservices.amazon.com")
 *   AMAZON_REGION (optional, default "us-east-1")
 *
 * Docs: https://webservices.amazon.com/paapi5/documentation/
 *
 * Note: Amazon only grants PA-API access once your Associates account has
 * referred a small number of qualifying sales — brand new accounts may need
 * to make a few manual affiliate-link sales first before this unlocks.
 */

const SERVICE = "ProductAdvertisingAPI";
const TARGET = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems";

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function signRequest({ method, host, path, payload, region, accessKey, secretKey, amzDate }) {
  const dateStamp = amzDate.slice(0, 8);
  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${TARGET}\n`;
  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";

  const canonicalRequest = [
    method,
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    sha256Hex(payload),
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign).toString("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { authorization, signedHeaders };
}

export function isAmazonConfigured() {
  return Boolean(
    process.env.AMAZON_ACCESS_KEY && process.env.AMAZON_SECRET_KEY && process.env.AMAZON_PARTNER_TAG
  );
}

/** Pulls the 10-character ASIN out of a normal amazon.com product URL. */
export function extractAsin(url) {
  const match = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Fetches current price + availability for a batch of ASINs (max 10 per
 * Amazon's API limit). Returns a map of ASIN -> { priceUsd, inStock }.
 */
export async function fetchAmazonItems(asins) {
  if (!isAmazonConfigured()) {
    console.warn("[amazon] Skipping — AMAZON_ACCESS_KEY/SECRET_KEY/PARTNER_TAG not set.");
    return new Map();
  }
  if (asins.length === 0) return new Map();

  const host = process.env.AMAZON_HOST || "webservices.amazon.com";
  const region = process.env.AMAZON_REGION || "us-east-1";
  const path = "/paapi5/getitems";
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");

  const payload = JSON.stringify({
    ItemIds: asins,
    Resources: ["Offers.Listings.Price", "Offers.Listings.Availability.Message", "ItemInfo.Title"],
    PartnerTag: process.env.AMAZON_PARTNER_TAG,
    PartnerType: "Associates",
    Marketplace: process.env.AMAZON_MARKETPLACE || "www.amazon.com",
  });

  const { authorization } = signRequest({
    method: "POST",
    host,
    path,
    payload,
    region,
    accessKey: process.env.AMAZON_ACCESS_KEY,
    secretKey: process.env.AMAZON_SECRET_KEY,
    amzDate,
  });

  try {
    const response = await fetch(`https://${host}${path}`, {
      method: "POST",
      headers: {
        "content-encoding": "amz-1.0",
        "content-type": "application/json; charset=utf-8",
        "x-amz-date": amzDate,
        "x-amz-target": TARGET,
        Authorization: authorization,
      },
      body: payload,
    });

    if (!response.ok) {
      console.warn(`[amazon] API returned ${response.status}: ${await response.text()}`);
      return new Map();
    }

    const data = await response.json();
    const results = new Map();
    for (const item of data.ItemsResult?.Items || []) {
      const listing = item.Offers?.Listings?.[0];
      results.set(item.ASIN, {
        priceUsd: listing?.Price?.Amount,
        inStock: Boolean(listing),
      });
    }
    return results;
  } catch (err) {
    console.warn(`[amazon] Fetch failed: ${err.message}`);
    return new Map();
  }
}
