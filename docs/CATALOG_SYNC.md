# Keeping the Catalog Fresh: What's Automatic vs Manual

This explains, honestly, what part of "updating your product catalog" can run on
autopilot every 24 hours, and what still needs a human — based on real testing
done while building this, not just theory.

## The short version

| Source | New product discovery | Price/stock refresh (every 24h) |
|---|---|---|
| **Amazon** | ❌ Not built (possible later via keyword search) | ✅ Automatic, via official API |
| **AliExpress** | ❌ Not built (possible later via keyword search) | ✅ Automatic, via official API (needs an extra dev-app approval step) |
| **Kilimall** | ❌ Not possible — no public API | ⚠️ Manual (see why below) |
| **Jumia** | ❌ Not possible — no public API | ⚠️ Manual (see why below) |
| **Temu** | ❌ Not possible — no public API | ⚠️ Manual |

**No affiliate business — including huge ones — automatically discovers brand
new products from a retailer's entire catalog without that retailer providing
an API for it.** What *is* realistic and what this repo now does: automatically
keep the **price and availability of products you've chosen to feature**
up to date, for the sources that offer an API to do so.

## How the automatic part works

`.github/workflows/sync-catalog.yml` runs `whatsapp-bot/scripts/sync-catalog.mjs`
once a day (and can also be triggered manually from the GitHub Actions tab).
That script:

1. Reads your current catalog (`whatsapp-bot/src/data/products.json`).
2. For each product, checks its `source`:
   - **`amazon`** → calls the official **Product Advertising API** to get the
     live price (`scripts/providers/amazon.mjs`).
   - **`aliexpress`** → calls the official **AliExpress Affiliate API**
     (`scripts/providers/aliexpress.mjs`).
   - **`kilimall` / `jumia` / `temu`** → skipped by default (see below).
3. Writes any updated prices/ratings back into **both**
   `whatsapp-bot/src/data/products.json` and `website/data/products.json`,
   plus a `lastChecked` timestamp.
4. If anything changed, the workflow commits and pushes automatically —
   your live site and bot pick up the new prices next time they read the file
   (redeploy your website/bot after a sync if your hosting doesn't
   auto-redeploy on push).

If a source's API credentials aren't configured, that source is simply
**skipped with a log message** — nothing breaks, you just don't get automatic
updates for it yet.

## Why Kilimall/Jumia/Temu can't be safely automated the same way

While building this, I tested it directly against a real Jumia product page:

- The page returns HTTP 200 and ~490KB of HTML.
- It does **not** contain the product's real price in a form a simple
  automated request can read — Jumia (like Kilimall) loads the actual price
  via JavaScript *after* the page loads, using their internal app, not in
  the initial page source.
- Getting that number would require running a full headless browser (like a
  hidden Chrome instance) to let the page's JavaScript execute — which is
  slower, far more fragile (breaks silently whenever they redesign the page),
  and closer to the kind of automated access most sites' Terms of Service
  restrict. This starter kit deliberately does **not** do that automatically —
  it's a decision you should make explicitly and separately if you want to
  go there, not something that should run quietly in the background.

`scripts/providers/structuredDataCheck.mjs` is left in the codebase, off by
default (`ENABLE_STRUCTURED_DATA_CHECK=false`), for the lighter-weight case
where a site *does* publish proper `Product`/`Offer` structured data in its
raw HTML (some do — it's what lets Google show a price in search results).
It's a genuine attempt, tested honestly, not a placeholder — it just won't
help for Kilimall/Jumia/Temu as they're built today.

## What to actually do day-to-day

1. **For Kilimall, Jumia, Temu:** update `priceKes`/`priceUsd`,
   `originalPriceKes`, `rating`, and `reviews` by hand in both
   `whatsapp-bot/src/data/products.json` and `website/data/products.json`
   whenever you refresh your featured picks (weekly is a reasonable cadence
   for a small catalog). This is genuinely how most affiliate sites for these
   kinds of platforms operate.
2. **For Amazon/AliExpress:** once you're approved and have added the API
   credentials as GitHub Actions secrets (see below), those two sources will
   quietly stay fresh on their own, every day, with zero effort from you.

## Setting up the automatic sources

1. **Amazon** — apply for Product Advertising API access from your Associates
   account (usually unlocked after your first few qualifying referred sales).
   You'll get an Access Key, Secret Key, and use your existing Partner Tag.
2. **AliExpress** — beyond the basic affiliate signup, create a developer app
   at [open.aliexpress.com](https://open.aliexpress.com/) under the same
   account to get an App Key + App Secret, plus your Tracking ID (PID) from
   the affiliate portal.
3. In your GitHub repo: **Settings → Secrets and variables → Actions**, add:
   - `AMAZON_ACCESS_KEY`, `AMAZON_SECRET_KEY`, `AMAZON_PARTNER_TAG`
   - `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`, `ALIEXPRESS_TRACKING_ID`
4. That's it — the next scheduled run (or a manual "Run workflow" click on
   the Actions tab) will start using them automatically.

## Running it yourself locally

```bash
cd whatsapp-bot
npm install
cp .env.example .env   # fill in whichever credentials you have
npm run sync:catalog
```

Safe to run any time — sources without credentials configured are skipped,
and it only ever writes back the fields it actually managed to refresh.
