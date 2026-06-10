/**
 * Item linker — uses Claude with the web_search tool to find each deal item's
 * product page on the store's own website AND its regular (non-sale) price.
 * Runs during the background enrichment pass only.
 *
 * The regular price is best-effort: store websites localise prices, so we pass
 * the ZIP into the search for regional accuracy, but treat the result as
 * approximate. Discount % is only computed when regularPrice > salePrice.
 */
const Anthropic = require('@anthropic-ai/sdk');

const AnthropicClass = Anthropic.default ?? Anthropic.Anthropic ?? Anthropic;
let client = null;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw Object.assign(new Error('ANTHROPIC_API_KEY not configured.'), { code: 'NO_ANTHROPIC_KEY' });
    }
    client = new AnthropicClass({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// Store chain → official website domain (restricts the web search)
const DOMAIN_MAP = [
  ['publix',           'publix.com'],
  ['walmart',          'walmart.com'],
  ['target',           'target.com'],
  ['costco',           'costco.com'],
  ['sprouts',          'sprouts.com'],
  ['food lion',        'foodlion.com'],
  ['dollar general',   'dollargeneral.com'],
  ['family dollar',    'familydollar.com'],
  ['aldi',             'aldi.us'],
  ['lidl',             'lidl.com'],
  ['h mart',           'hmart.com'],
  ['whole foods',      'wholefoodsmarket.com'],
  ['wegmans',          'wegmans.com'],
  ['meijer',           'meijer.com'],
  ['ingles',           'ingles-markets.com'],
  ['lowes foods',      'lowesfoods.com'],
  ['earth fare',       'earthfare.com'],
  ['restaurant depot', 'restaurantdepot.com'],
  ['kroger',           'kroger.com'],
  ['safeway',          'safeway.com'],
  ['trader joe',       'traderjoes.com'],
];

function domainFor(storeName) {
  const s = (storeName || '').toLowerCase();
  for (const [key, domain] of DOMAIN_MAP) {
    if (s.includes(key)) return domain;
  }
  return null;
}

const cache = new Map(); // "store::item::zip" → { url, regularPrice } | null

/**
 * Find the product page URL and regular price for one item.
 * Returns { url: string|null, regularPrice: number|null }.
 */
async function findItemInfo(itemName, storeName, zip = '', city = '', state = '') {
  const key = `${(storeName || '').toLowerCase()}::${(itemName || '').toLowerCase().trim()}::${zip}`;
  if (cache.has(key)) return cache.get(key);

  const domain = domainFor(storeName);
  let result = { url: null, regularPrice: null };

  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 2,
        ...(domain ? { allowed_domains: [domain] } : {}),
        // Localise search results to the user's area for region-accurate pricing
        ...(city && state ? {
          user_location: { type: 'approximate', city, region: state, country: 'US' },
        } : {}),
      }],
      messages: [{
        role: 'user',
        content: `Search the web for the product page of "${itemName}" on the ${storeName} website${domain ? ` (${domain})` : ''}.\n\n` +
                 `Then respond with ONLY this JSON (no other text):\n` +
                 `{"url": "<URL of the specific product page, not a search or category page, or null>", ` +
                 `"regularPrice": <the product's regular non-sale price in dollars as a number, if visible in any search result snippet, otherwise null>}`,
      }],
    });

    const text = (response.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(' ');

    // Parse the JSON out of the reply
    const jsonMatch = text.match(/\{[^{}]*"url"[^{}]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        let url = typeof parsed.url === 'string' && parsed.url.startsWith('http')
          ? parsed.url.replace(/[.,;]+$/, '') : null;
        if (url && /\/(search|category|browse|s\?|results)/i.test(url)) url = null;
        const price = typeof parsed.regularPrice === 'number' && parsed.regularPrice > 0
          ? parsed.regularPrice : null;
        result = { url, regularPrice: price };
      } catch { /* malformed JSON — fall through to bare URL fallback */ }
    }

    // Fallback: pull a bare product URL out of the text if JSON parsing failed
    if (!result.url) {
      const m = text.match(/https?:\/\/[^\s"'<>)\]]+/);
      if (m) {
        const url = m[0].replace(/[.,;]+$/, '');
        if (!/\/(search|category|browse|s\?|results)/i.test(url)) result.url = url;
      }
    }
  } catch (err) {
    console.warn(`[ItemLinker] "${itemName}" @ ${storeName}: ${err.message}`);
  }

  cache.set(key, result);
  return result;
}

/**
 * Enrich deals in place with itemUrl + originalPrice + discountPct.
 * Only fills originalPrice when the found regular price is higher than the
 * flyer sale price (otherwise it's stale/mismatched data — discard).
 */
async function enrichDealsWithLinks(deals, { concurrency = 4, maxLookups = 250, zip = '', city = '', state = '' } = {}) {
  const targets = deals.filter((d) => !d.itemUrl).slice(0, maxLookups);
  let linked = 0, priced = 0;

  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((d) => findItemInfo(d.name, d.storeName, zip, city, state))
    );
    results.forEach((r, j) => {
      if (r.status !== 'fulfilled' || !r.value) return;
      const deal = batch[j];
      const { url, regularPrice } = r.value;

      if (url) { deal.itemUrl = url; linked++; }

      // Fill original price + discount only when it makes sense vs the sale price
      if (
        regularPrice != null &&
        deal.salePrice != null &&
        deal.originalPrice == null &&
        regularPrice > deal.salePrice &&
        regularPrice < deal.salePrice * 5 // sanity: reject wildly mismatched prices
      ) {
        deal.originalPrice = regularPrice;
        deal.discountPct = Math.round(((regularPrice - deal.salePrice) / regularPrice) * 100);
        priced++;
      }
    });
  }

  console.log(`[ItemLinker] Linked ${linked}/${targets.length} items, found regular price for ${priced}`);
  return deals;
}

module.exports = { findItemInfo, enrichDealsWithLinks };
