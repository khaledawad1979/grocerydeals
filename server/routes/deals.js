const express = require('express');
const router = express.Router();
const { zipToLatLng } = require('../services/geocode');
const kroger = require('../services/kroger');
const flipp = require('../services/flipp');

// GET /api/deals?zip=30518&radius=10
router.get('/', async (req, res) => {
  const { zip, radius } = req.query;
  const radiusMiles = parseFloat(radius) || 10;

  if (!zip) {
    return res.status(400).json({ error: 'ZIP code is required.' });
  }

  let location;
  try {
    location = await zipToLatLng(zip);
  } catch (err) {
    const status = err.code === 'INVALID_ZIP' || err.code === 'ZIP_NOT_FOUND' ? 400 : 503;
    return res.status(status).json({ error: err.message });
  }

  const { lat, lng } = location;
  const allStores = [];
  const allDeals = [];
  const errors = [];

  // --- Kroger ---
  let krogerStores = [];
  try {
    krogerStores = (await kroger.findStores(lat, lng, radiusMiles)).filter(
      (s) => s.distance <= radiusMiles
    );
    allStores.push(...krogerStores);

    // Fetch deals concurrently, cap at 5 stores to avoid overwhelming the API
    const storeSubset = krogerStores.slice(0, 5);
    const dealResults = await Promise.allSettled(
      storeSubset.map((s) => kroger.getDealsForStore(s))
    );
    for (const result of dealResults) {
      if (result.status === 'fulfilled') {
        allDeals.push(...result.value);
      }
    }
  } catch (err) {
    errors.push({ source: 'Kroger', message: err.message });
  }

  // --- Flipp ---
  try {
    const { stores: flippStores, deals: flippDeals } = await flipp.getDealsNearZip(
      zip, lat, lng, radiusMiles, location.city, location.state
    );
    allStores.push(...flippStores);
    allDeals.push(...flippDeals);
  } catch (err) {
    errors.push({ source: 'Flipp', message: err.message });
  }

  if (allStores.length === 0 && errors.length === 0) {
    return res.json({
      location,
      stores: [],
      deals: [],
      totalDeals: 0,
      message: `No grocery stores found within ${radiusMiles} miles. Try increasing your radius.`,
    });
  }

  // Deduplicate deals by id
  const seenIds = new Set();
  const uniqueDeals = allDeals.filter((d) => {
    if (seenIds.has(d.id)) return false;
    seenIds.add(d.id);
    return true;
  });

  // Group deals by storeId for easy frontend rendering
  const storeMap = {};
  for (const store of allStores) {
    storeMap[store.id] = { ...store, deals: [] };
  }
  for (const deal of uniqueDeals) {
    if (storeMap[deal.storeId]) {
      storeMap[deal.storeId].deals.push(deal);
    }
  }

  const storeList = Object.values(storeMap)
    .filter((s) => s.deals.length > 0)
    .sort((a, b) => a.distance - b.distance);

  res.json({
    location,
    stores: storeList,
    totalDeals: uniqueDeals.length,
    errors: errors.length ? errors : undefined,
  });
});

module.exports = router;
