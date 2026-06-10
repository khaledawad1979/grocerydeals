/**
 * FlippAI Agent
 * -------------
 * Uses the Flipp detail API to get every item in a flyer, then runs each
 * item's cutout image through Claude Vision to extract structured deal data
 * (name, sale price, original price, discount %, category, unit).
 *
 * Items that already have complete price data from the API are returned
 * immediately without a Vision call. Only incomplete items go to Claude.
 */

const axios     = require('axios');
const Anthropic = require('@anthropic-ai/sdk');

const FLIPP_API = 'https://backflipp.wishabi.com/flipp';

// How many Vision calls to run concurrently (respect Anthropic rate limits)
const VISION_CONCURRENCY = 3;

// Support both ESM default export and CommonJS
const AnthropicClass = Anthropic.default ?? Anthropic;

let anthropic = null;
function getClient() {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw Object.assign(new Error('ANTHROPIC_API_KEY not configured.'), { code: 'NO_ANTHROPIC_KEY' });
    }
    anthropic = new AnthropicClass({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

/**
 * Fetch and AI-enrich all items from a single Flipp flyer.
 * @param {object} flyer - flyer object from the flyers list
 * @param {string} merchantName
 * @param {string} storeId
 * @returns {Promise<object[]>} array of normalised deal objects
 */
async function extractDealsFromFlyer(flyer, merchantName, storeId, options = {}) {
  const { visionEnabled = true } = options;
  const today = new Date().toISOString().slice(0, 10);
  const flyerStart = (flyer.valid_from || today).slice(0, 10);
  const flyerEnd   = (flyer.valid_to   || today).slice(0, 10);

  // 1. Fetch detailed flyer data (items + pages)
  let rawItems = [];
  try {
    const res = await axios.get(`${FLIPP_API}/flyers/${flyer.id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      timeout: 12000,
    });
    rawItems = res.data.items || [];
  } catch (err) {
    console.warn(`[FlippAI] Could not fetch flyer ${flyer.id}: ${err.message}`);
    return [];
  }

  // Filter to items that have a cutout image and a real name
  const usable = rawItems.filter(
    (i) => i.name && i.name.length > 1 && i.cutout_image_url &&
           !i.name.toUpperCase().includes(merchantName.toUpperCase().slice(0, 4)) // skip store-logo items
  );

  // Split: items with complete API data vs items needing Vision enrichment
  const complete   = [];
  const needVision = [];

  for (const item of usable) {
    const price    = parseFloat(item.price) || null;
    const discount = item.discount ? parseInt(item.discount) : null;

    if (price !== null) {
      // API already gave us the price — no Vision call needed
      complete.push(buildDeal(item, price, null, discount, merchantName, storeId, flyerStart, flyerEnd, today));
    } else {
      needVision.push(item);
    }
  }

  console.log(`[FlippAI] ${merchantName} flyer ${flyer.id}: ${complete.length} direct, ${needVision.length} need Vision (vision=${visionEnabled})`);

  // 2. Run Vision in batches (skipped if visionEnabled=false)
  if (!visionEnabled) return complete;
  const visionDeals = [];
  for (let i = 0; i < needVision.length; i += VISION_CONCURRENCY) {
    const batch   = needVision.slice(i, i + VISION_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((item) => analyzeItemImage(item, merchantName))
    );

    for (let j = 0; j < batch.length; j++) {
      const item   = batch[j];
      const result = results[j];
      if (result.status === 'rejected') continue;

      const { salePrice, originalPrice, discountPct, name, category, unit } = result.value;
      if (!salePrice && !originalPrice) continue; // Vision couldn't find price either — skip

      visionDeals.push(buildDeal(
        { ...item, name: name || item.name },
        salePrice,
        originalPrice,
        discountPct,
        merchantName,
        storeId,
        flyerStart,
        flyerEnd,
        today,
        category,
        unit
      ));
    }
  }

  return [...complete, ...visionDeals];
}

/**
 * Send a single item cutout image to Claude Vision and extract deal data.
 */
async function analyzeItemImage(item, merchantName) {

  // Fetch image as base64
  let imageBase64, mediaType;
  try {
    const res = await axios.get(item.cutout_image_url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    imageBase64 = Buffer.from(res.data).toString('base64');
    // Derive media type from URL extension — CDN headers are unreliable
    const ext = (item.cutout_image_url.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
    const extMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
    mediaType = extMap[ext] || (res.headers['content-type'] || 'image/jpeg').split(';')[0];
    // Claude only accepts these four types — fall back to jpeg if unknown
    if (!['image/jpeg','image/png','image/gif','image/webp'].includes(mediaType)) mediaType = 'image/jpeg';
  } catch {
    return {};
  }

  const prompt = `You are analyzing a grocery store deal/advertisement cutout image from ${merchantName}.

Extract the following information from the image and respond with ONLY valid JSON (no markdown, no explanation):
{
  "name": "product name and size/quantity if visible",
  "salePrice": <number or null>,
  "originalPrice": <number or null>,
  "discountPct": <integer percent off or null>,
  "category": "one of: Produce, Dairy & Eggs, Meat & Seafood, Bakery, Frozen, Beverages, Snacks, Breakfast, Deli, Health & Beauty, Household, Grocery",
  "unit": "size or unit shown (e.g. '12 oz', '2 lb') or null"
}

Rules:
- salePrice is the deal/sale price shown most prominently
- originalPrice is the regular/was price if shown, otherwise null
- discountPct: calculate from prices if not explicitly shown, otherwise null
- If no price is visible at all, set both prices to null
- Respond with ONLY the JSON object`;

  try {
    const client = getClient(); // inside try so auth errors surface via console.warn
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [{
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 },
        }, {
          type: 'text',
          text: prompt,
        }],
      }],
    });

    const raw = response.content[0]?.text?.trim() || '{}';
    // Strip any accidental markdown fences
    const json = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    return JSON.parse(json);
  } catch (err) {
    console.warn(`[FlippAI] Vision failed for "${item.name}": ${err.message}`);
    return {};
  }
}

/**
 * Build a normalised deal object from raw item + extracted data.
 */
function buildDeal(item, salePrice, originalPrice, discountPct, merchantName, storeId, flyerStart, flyerEnd, today, aiCategory, aiUnit) {
  const computedDiscount =
    discountPct ?? (
      originalPrice && salePrice && originalPrice > salePrice
        ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
        : null
    );

  return {
    id:            `flipp-ai-${item.id}`,
    storeId,
    storeName:     merchantName,
    storeChain:    merchantName,
    name:          item.name,
    brand:         item.brand || null,
    category:      aiCategory || normalizeCategory(item.name),
    imageUrl:      item.cutout_image_url || null,
    originalPrice: originalPrice ?? null,
    salePrice:     salePrice ?? null,
    discountPct:   computedDiscount,
    unit:          aiUnit || item.size || null,
    description:   null,
    startDate:     flyerStart,
    endDate:       flyerEnd,
    todayOnly:     flyerEnd === today,
    source:        'flipp',
  };
}

function normalizeCategory(name) {
  const n = (name || '').toLowerCase();
  if (/chicken|beef|pork|salmon|shrimp|steak|turkey|meat|fish/.test(n)) return 'Meat & Seafood';
  if (/milk|cheese|yogurt|egg|butter|cream/.test(n)) return 'Dairy & Eggs';
  if (/apple|banana|berry|fruit|vegetable|salad|tomato|pepper|onion/.test(n)) return 'Produce';
  if (/bread|bagel|muffin|cake|bakery|roll/.test(n)) return 'Bakery';
  if (/frozen|pizza|ice cream/.test(n)) return 'Frozen';
  if (/juice|soda|water|drink|beverage|coffee|tea/.test(n)) return 'Beverages';
  if (/chip|snack|cookie|cracker|candy|popcorn/.test(n)) return 'Snacks';
  if (/cereal|oat|granola|breakfast/.test(n)) return 'Breakfast';
  if (/deli|sandwich|lunch meat/.test(n)) return 'Deli';
  if (/shampoo|soap|lotion|vitamin|medicine|razor/.test(n)) return 'Health & Beauty';
  if (/detergent|clean|paper towel|toilet/.test(n)) return 'Household';
  return 'Grocery';
}

module.exports = { extractDealsFromFlyer };
