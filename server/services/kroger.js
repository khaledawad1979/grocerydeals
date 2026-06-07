const axios = require('axios');
const { haversine } = require('../utils/haversine');

const TOKEN_URL = 'https://api.kroger.com/v1/connect/oauth2/token';
const API_BASE  = 'https://api.kroger.com/v1';

// Search terms that cover most grocery departments
const SEARCH_TERMS = [
  'chicken', 'beef', 'pork', 'seafood', 'turkey',
  'milk', 'cheese', 'yogurt', 'eggs', 'butter',
  'bread', 'bakery', 'muffin', 'bagel',
  'apple', 'banana', 'orange', 'strawberry', 'salad',
  'frozen pizza', 'ice cream', 'frozen meals',
  'juice', 'soda', 'water', 'coffee',
  'cereal', 'snack', 'chips', 'cookie',
  'pasta', 'rice', 'soup', 'sauce',
];

let cachedToken  = null;
let tokenExpiry  = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const clientId     = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw Object.assign(new Error('Kroger API credentials not configured.'), { code: 'KROGER_NO_CREDS' });
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await axios.post(
    TOKEN_URL,
    'grant_type=client_credentials&scope=product.compact',
    { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
  );

  cachedToken = res.data.access_token;
  tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;
  return cachedToken;
}

/**
 * Find Kroger-family stores within radiusMiles of lat/lng.
 */
async function findStores(lat, lng, radiusMiles) {
  const token = await getToken();

  const res = await axios.get(`${API_BASE}/locations`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      'filter.lat.near':       lat,
      'filter.lon.near':       lng,
      'filter.radiusInMiles':  Math.min(radiusMiles, 100),
      'filter.limit':          50,
    },
    timeout: 12000,
  });

  return (res.data.data || []).map((loc) => ({
    id:       loc.locationId,
    name:     loc.name,
    chain:    loc.chain || 'Kroger',
    source:   'kroger',
    address:  [loc.address?.addressLine1, loc.address?.city, loc.address?.state, loc.address?.zipCode].filter(Boolean).join(', '),
    lat:      loc.geolocation?.latitude,
    lng:      loc.geolocation?.longitude,
    distance: haversine(lat, lng, loc.geolocation?.latitude, loc.geolocation?.longitude),
  }));
}

/**
 * Fetch sale items for a store by searching across grocery categories.
 * Returns normalized deal objects.
 */
async function getDealsForStore(store) {
  const token = await getToken();
  const today = new Date().toISOString().slice(0, 10);
  const seen  = new Set();
  const deals = [];

  // Run searches in parallel batches of 5 to respect rate limits
  const batchSize = 5;
  for (let i = 0; i < SEARCH_TERMS.length; i += batchSize) {
    const batch = SEARCH_TERMS.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((term) =>
        axios.get(`${API_BASE}/products`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            'filter.term':        term,
            'filter.locationId':  store.id,
            'filter.limit':       50,
          },
          timeout: 12000,
        })
      )
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const products = result.value.data?.data || [];

      for (const p of products) {
        const priceInfo = p.items?.[0]?.price;
        if (!priceInfo?.promo) continue; // only include items on promotion

        const regularPrice = priceInfo.regular ?? null;
        const salePrice    = priceInfo.promo    ?? null;
        const discountPct  =
          regularPrice && salePrice && regularPrice > salePrice
            ? Math.round(((regularPrice - salePrice) / regularPrice) * 100)
            : null;

        const dealKey = `${store.id}::${p.productId}`;
        if (seen.has(dealKey)) continue;
        seen.add(dealKey);

        deals.push({
          id:           `kroger-${p.productId}`,
          storeId:      store.id,
          storeName:    store.name,
          storeChain:   store.chain,
          name:         p.description,
          brand:        p.brand || null,
          category:     normalizeCategory(p.categories?.[0]),
          imageUrl:     p.images?.find((i) => i.perspective === 'front')?.sizes?.find((s) => s.size === 'medium')?.url || null,
          originalPrice: regularPrice,
          salePrice,
          discountPct,
          unit:         p.items?.[0]?.size || null,
          startDate:    today,
          endDate:      today,
          todayOnly:    true,
          source:       'kroger',
        });
      }
    }
  }

  return deals;
}

function normalizeCategory(raw) {
  if (!raw) return 'Other';
  const r = raw.toLowerCase();
  if (r.includes('produce') || r.includes('fruit') || r.includes('vegetable')) return 'Produce';
  if (r.includes('dairy') || r.includes('cheese') || r.includes('milk') || r.includes('egg')) return 'Dairy & Eggs';
  if (r.includes('meat') || r.includes('beef') || r.includes('chicken') || r.includes('pork') || r.includes('seafood')) return 'Meat & Seafood';
  if (r.includes('bakery') || r.includes('bread')) return 'Bakery';
  if (r.includes('frozen')) return 'Frozen';
  if (r.includes('beverage') || r.includes('drink') || r.includes('water') || r.includes('juice')) return 'Beverages';
  if (r.includes('snack') || r.includes('chip') || r.includes('candy')) return 'Snacks';
  if (r.includes('cereal') || r.includes('breakfast')) return 'Breakfast';
  if (r.includes('deli')) return 'Deli';
  if (r.includes('personal') || r.includes('health') || r.includes('beauty')) return 'Health & Beauty';
  if (r.includes('household') || r.includes('cleaning')) return 'Household';
  return 'Grocery';
}

module.exports = { findStores, getDealsForStore };
