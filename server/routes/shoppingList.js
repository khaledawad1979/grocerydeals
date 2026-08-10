const express = require('express');
const router  = express.Router();
const cache   = require('../services/cache');
const { zipToLatLng } = require('../services/geocode');
const kroger  = require('../services/kroger');
const flipp   = require('../services/flipp');

/**
 * POST /api/shopping-list
 * Body: { items: string[], zip: string, radius: number }
 * Returns an optimized buy plan.
 */
router.post('/', async (req, res) => {
  const { items, zip, radius = 10 } = req.body;
  if (!zip) return res.status(400).json({ error: 'ZIP code is required.' });
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Provide at least one item.' });

  const radiusMiles = parseFloat(radius) || 10;

  // 1. Get all deals — use cache if available (populated by previous search)
  let allDeals = [];
  const cached = cache.get(zip, radiusMiles);
  if (cached?.stores) {
    for (const store of cached.stores) allDeals.push(...(store.deals || []));
  } else {
    // No cache — do a lightweight fetch
    try {
      const location = await zipToLatLng(zip);
      const { lat, lng } = location;

      const krogerStores = (await kroger.findStores(lat, lng, radiusMiles))
        .filter(s => s.distance <= radiusMiles);
      const results = await Promise.allSettled(
        krogerStores.slice(0, 5).map(s => kroger.getDealsForStore(s))
      );
      for (const r of results) if (r.status === 'fulfilled') allDeals.push(...r.value);

      const { deals: fd } = await flipp.getDealsNearZip(
        zip, lat, lng, radiusMiles, location.city, location.state,
        { visionEnabled: false }
      );
      allDeals.push(...fd);
    } catch (err) {
      return res.status(503).json({ error: `Could not fetch deals: ${err.message}` });
    }
  }

  // 2. Match each requested item to the cheapest deal per store
  const plan = items.map(itemName => matchItem(itemName.trim(), allDeals));

  // 3. Optimize: greedy cheapest-per-item, then group by store
  const optimized = optimize(plan);

  res.json(optimized);
});

/**
 * Find all deals matching an item name (fuzzy token match), return best per store.
 */
function matchItem(query, allDeals) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

  const scored = allDeals
    .filter(d => d.salePrice != null)
    .map(d => {
      const target = `${d.name || ''} ${d.brand || ''}`.toLowerCase();
      const hits = tokens.filter(t => target.includes(t)).length;
      return { deal: d, score: hits / tokens.length };
    })
    .filter(x => x.score >= 0.5)
    .sort((a, b) => b.score - a.score || a.deal.salePrice - b.deal.salePrice);

  // Best match per store
  const byStore = {};
  for (const { deal } of scored) {
    if (!byStore[deal.storeId]) byStore[deal.storeId] = deal;
  }

  return {
    query,
    matched: Object.values(byStore).sort((a, b) => a.salePrice - b.salePrice),
  };
}

/**
 * Greedy optimizer: assign each item to its cheapest store.
 * Returns summary + per-store breakdown + savings vs single-store.
 */
function optimize(plan) {
  const matched   = plan.filter(p => p.matched.length > 0);
  const unmatched = plan.filter(p => p.matched.length === 0).map(p => p.query);

  // Cheapest option per item (across all stores)
  const assignments = matched.map(p => ({
    query:     p.query,
    deal:      p.matched[0],
    allOptions: p.matched,
  }));

  // Group by store
  const storeMap = {};
  for (const a of assignments) {
    const s = a.deal.storeId;
    if (!storeMap[s]) storeMap[s] = { storeId: s, storeName: a.deal.storeName, items: [], total: 0 };
    storeMap[s].items.push({ query: a.query, deal: a.deal });
    storeMap[s].total = Math.round((storeMap[s].total + a.deal.salePrice) * 100) / 100;
  }
  const stores = Object.values(storeMap).sort((a, b) => b.items.length - a.items.length);

  // Best single-store total (store that covers most items cheapest)
  const singleStoreSavings = computeSingleStoreSavings(assignments);

  const optimizedTotal = assignments.reduce((s, a) => s + a.deal.salePrice, 0);
  const savings = Math.round((singleStoreSavings - optimizedTotal) * 100) / 100;

  return {
    stores,
    unmatched,
    optimizedTotal: Math.round(optimizedTotal * 100) / 100,
    singleStoreTotal: Math.round(singleStoreSavings * 100) / 100,
    savings: savings > 0 ? savings : 0,
    itemCount: matched.length,
  };
}

function computeSingleStoreSavings(assignments) {
  // For each store, sum its best price for each item (or use the cheapest
  // alternative at that store, falling back to the global cheapest)
  const storeIds = [...new Set(assignments.flatMap(a => a.allOptions.map(d => d.storeId)))];
  let best = Infinity;
  for (const sid of storeIds) {
    let total = 0;
    for (const a of assignments) {
      const opt = a.allOptions.find(d => d.storeId === sid);
      // If this store doesn't carry the item, use the global cheapest (must travel)
      total += opt ? opt.salePrice : a.deal.salePrice;
    }
    if (total < best) best = total;
  }
  return best === Infinity ? 0 : best;
}

module.exports = router;
