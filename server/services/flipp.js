const axios = require('axios');
const { extractDealsFromFlyer } = require('./flippAI');
const { locateStore } = require('./storeLocator');
const { enrichDealsWithLinks } = require('./itemLinker');

const FLIPP_API = 'https://backflipp.wishabi.com/flipp';

/**
 * Fetch all active grocery flyers near a ZIP code, then use the FlippAI agent
 * to extract individual deal items from each flyer.
 * Returns { stores, deals } — same shape as before, but with real item cards.
 */
async function getDealsNearZip(zip, lat, lng, radiusMiles, city = '', state = '', options = {}) {
  const { visionEnabled = true } = options;
  const today = new Date().toISOString().slice(0, 10);

  // 1. Fetch flyer list
  let flyers;
  try {
    const res = await axios.get(`${FLIPP_API}/flyers`, {
      params: { locale: 'en-US', postal_code: zip, sid: 'flipp-web' },
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      timeout: 15000,
    });
    flyers = res.data.flyers || [];
  } catch (err) {
    throw Object.assign(new Error(`Flipp API unavailable: ${err.message}`), { code: 'FLIPP_ERROR' });
  }

  // 2. Filter to grocery flyers active today
  const groceryFlyers = flyers.filter((f) => {
    const cats  = (f.categories_csv || '').toLowerCase();
    const start = (f.valid_from || '').slice(0, 10);
    const end   = (f.valid_to   || '').slice(0, 10);
    return (cats.includes('groceries') || cats.includes('grocery')) && end >= today && start <= today;
  });

  const stores     = [];
  const deals      = [];
  const seenStores = new Set();
  const seenDeals  = new Set();

  // Build city-state slug for flyer URLs
  const citySlug = city && state
    ? `${city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${state.toLowerCase()}`
    : 'us';

  // 3. Process flyers — cap at 8 to avoid excessive API/Vision calls
  const flyerSubset = groceryFlyers.slice(0, 8);

  for (const flyer of flyerSubset) {
    const merchantName = (flyer.merchant || '').trim() || 'Unknown Store';
    const storeId      = `flipp-${flyer.merchant_id || flyer.id}`;
    const merchantSlug = merchantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const flyerUrl     = `https://flipp.com/en-us/${citySlug}/weekly_ad/${flyer.id}-${merchantSlug}`;

    if (!seenStores.has(storeId)) {
      seenStores.add(storeId);
      stores.push({
        id: storeId,
        name: merchantName,
        chain: merchantName,
        source: 'flipp',
        address: '',
        lat,
        lng,
        distance: null, // unknown until located via OpenStreetMap (background pass)
        flyerUrl,
      });
    }

    // 4. Use AI agent to extract deal items (or fast-path without Vision)
    let flyerDeals = [];
    try {
      flyerDeals = await extractDealsFromFlyer(flyer, merchantName, storeId, { visionEnabled });
    } catch (err) {
      console.warn(`[Flipp] AI extraction failed for ${merchantName}: ${err.message}`);
      continue;
    }

    // Deduplicate by name within same store
    for (const deal of flyerDeals) {
      const key = `${storeId}::${deal.name.toLowerCase().trim()}`;
      if (seenDeals.has(key)) continue;
      seenDeals.add(key);
      deals.push(deal);
    }
  }

  // 5. Locate each merchant's nearest branch via OpenStreetMap (slow path only —
  //    ~1.1s per merchant due to Nominatim rate limits, results cached per zip)
  if (visionEnabled) {
    for (const store of stores) {
      const loc = await locateStore(store.name, zip, lat, lng, radiusMiles);
      if (loc) {
        store.lat      = loc.lat;
        store.lng      = loc.lng;
        store.address  = loc.address;
        store.distance = Math.round(loc.distance * 10) / 10;
      }
    }

    // 6. Find each item's product page + regular price on the store's website
    //    (web search, cached per item+zip — computes discount % vs sale price)
    try {
      await enrichDealsWithLinks(deals, { zip, city, state });
    } catch (err) {
      console.warn(`[Flipp] Item link enrichment failed: ${err.message}`);
    }
  }

  return { stores, deals };
}

module.exports = { getDealsNearZip };
