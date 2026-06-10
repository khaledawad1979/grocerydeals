/**
 * Item linker — uses Claude with the web_search tool to find each deal item's
 * product page on the store's own website. Runs during the background
 * enrichment pass only (one web search per item, concurrency-limited).
 *
 * Items where no product page is found get itemUrl = null and the frontend
 * renders them as plain (non-clickable) cards — no guessed URLs that 404.
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

const cache = new Map(); // "store::item" → url | null

/**
 * Find the product page URL for one item on the store's website.
 * Returns a URL string or null.
 */
async function findItemUrl(itemName, storeName) {
  const key = `${(storeName || '').toLowerCase()}::${(itemName || '').toLowerCase().trim()}`;
  if (cache.has(key)) return cache.get(key);

  const domain = domainFor(storeName);
  let url = null;

  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 1,
        ...(domain ? { allowed_domains: [domain] } : {}),
      }],
      messages: [{
        role: 'user',
        content: `Find the product page for "${itemName}" on the ${storeName} website${domain ? ` (${domain})` : ''}. ` +
                 `Respond with ONLY the full URL of the best-matching product page. ` +
                 `It must be a specific product page, not a search results or category page. ` +
                 `If you cannot find a specific product page, respond with exactly: NONE`,
      }],
    });

    const text = (response.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(' ');

    const match = text.match(/https?:\/\/[^\s"'<>)\]]+/);
    if (match && !/NONE/i.test(text.slice(0, 10))) {
      url = match[0].replace(/[.,;]+$/, '');
      // Reject obvious non-product pages
      if (/\/(search|category|browse|s\?|results)/i.test(url)) url = null;
    }
  } catch (err) {
    console.warn(`[ItemLinker] "${itemName}" @ ${storeName}: ${err.message}`);
  }

  cache.set(key, url);
  return url;
}

/**
 * Enrich an array of deals with itemUrl, in place.
 * Concurrency-limited; caps total lookups per call to bound cost/time.
 */
async function enrichDealsWithLinks(deals, { concurrency = 4, maxLookups = 250 } = {}) {
  const targets = deals.filter((d) => !d.itemUrl).slice(0, maxLookups);
  let found = 0;

  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((d) => findItemUrl(d.name, d.storeName))
    );
    results.forEach((r, j) => {
      if (r.status === 'fulfilled' && r.value) {
        batch[j].itemUrl = r.value;
        found++;
      }
    });
  }

  console.log(`[ItemLinker] Linked ${found}/${targets.length} items`);
  return deals;
}

module.exports = { findItemUrl, enrichDealsWithLinks };
