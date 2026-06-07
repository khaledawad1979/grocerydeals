const axios = require('axios');

const FLIPP_API = 'https://backflipp.wishabi.com/flipp';

/**
 * Fetch grocery flyers near a ZIP code from Flipp.
 * Note: Flipp's per-item API is no longer publicly accessible. We return stores
 * that have active grocery flyers today, with a direct link to view each flyer.
 */
async function getDealsNearZip(zip, lat, lng, radiusMiles) {
  const today = new Date().toISOString().slice(0, 10);

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

  // Filter: grocery category + active today
  const groceryFlyers = flyers.filter((f) => {
    const cats  = (f.categories_csv || '').toLowerCase();
    const start = (f.valid_from || '').slice(0, 10);
    const end   = (f.valid_to   || '').slice(0, 10);
    return (cats.includes('groceries') || cats.includes('grocery')) && end >= today && start <= today;
  });

  const stores = [];
  const deals  = [];
  const seenStores = new Set();
  const seenDeals  = new Set();

  for (const flyer of groceryFlyers) {
    const flyerStart   = (flyer.valid_from || today).slice(0, 10);
    const flyerEnd     = (flyer.valid_to   || today).slice(0, 10);
    const merchantName = (flyer.merchant   || '').trim() || 'Unknown Store';
    // Use merchant_id so multiple flyers for the same chain collapse into one store
    const storeId      = `flipp-${flyer.merchant_id || flyer.id}`;
    const flyerUrl     = `https://flipp.com/en-us/flyers/${flyer.id}`;

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
        distance: 0,
        flyerUrl,
      });
    }

    // Create one synthetic "deal" card per active flyer so the store section is non-empty
    const dealKey = `${storeId}::flyer::${flyer.id}`;
    if (!seenDeals.has(dealKey)) {
      seenDeals.add(dealKey);
      deals.push({
        id: `flipp-${flyer.id}`,
        storeId,
        storeName: merchantName,
        storeChain: merchantName,
        name: `${merchantName} Weekly Ad`,
        brand: null,
        category: 'Grocery',
        imageUrl: flyer.thumbnail_url || null,
        originalPrice: null,
        salePrice: null,
        discountPct: null,
        unit: null,
        description: `Valid ${flyerStart} – ${flyerEnd}. Click to view all deals on Flipp.`,
        startDate: flyerStart,
        endDate: flyerEnd,
        todayOnly: flyerEnd === today,
        source: 'flipp',
        flyerUrl,
        isFlyerCard: true,
      });
    }
  }

  return { stores, deals };
}

module.exports = { getDealsNearZip };
