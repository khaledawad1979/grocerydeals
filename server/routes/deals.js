const express = require('express');
const router  = express.Router();
const { zipToLatLng } = require('../services/geocode');
const kroger  = require('../services/kroger');
const flipp   = require('../services/flipp');
const cache   = require('../services/cache');

// ─── GET /api/deals?zip=30518&radius=10 ──────────────────────────────────────
//
// Returns immediately with:
//   • All Kroger deals (fast — cached token, parallel store fetches)
//   • Flipp API-direct items (prices already in API, no Vision needed)
//   • aiReady: false  +  a background job ID while Vision enrichment runs
//
// Once the background Vision job finishes, the same endpoint returns the full
// enriched results (aiReady: true) from cache — instant on repeat calls.
//
router.get('/', async (req, res) => {
  const { zip, radius } = req.query;
  const radiusMiles = parseFloat(radius) || 10;

  if (!zip) return res.status(400).json({ error: 'ZIP code is required.' });

  // 1. Check cache — return full enriched results immediately if available
  const cached = cache.get(zip, radiusMiles);
  if (cached) return res.json({ ...cached, aiReady: true, fromCache: true });

  // 2. Geocode
  let location;
  try {
    location = await zipToLatLng(zip);
  } catch (err) {
    const status = err.code === 'INVALID_ZIP' || err.code === 'ZIP_NOT_FOUND' ? 400 : 503;
    return res.status(status).json({ error: err.message });
  }

  const { lat, lng } = location;
  const allStores = [];
  const allDeals  = [];
  const errors    = [];

  // 3. Kroger — full item-level deals (fast, parallel)
  try {
    const krogerStores = (await kroger.findStores(lat, lng, radiusMiles))
      .filter(s => s.distance <= radiusMiles);
    allStores.push(...krogerStores);

    const results = await Promise.allSettled(
      krogerStores.slice(0, 5).map(s => kroger.getDealsForStore(s))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') allDeals.push(...r.value);
    }
  } catch (err) {
    errors.push({ source: 'Kroger', message: err.message });
  }

  // 4. Flipp — API-direct items only (no Vision yet, sub-second)
  let flippPartialStores = [];
  let flippPartialDeals  = [];
  try {
    const { stores: fs, deals: fd } = await flipp.getDealsNearZip(
      zip, lat, lng, radiusMiles, location.city, location.state,
      { visionEnabled: false }   // fast path — skip Vision
    );
    flippPartialStores = fs;
    flippPartialDeals  = fd;
    allStores.push(...fs);
    allDeals.push(...fd);
  } catch (err) {
    errors.push({ source: 'Flipp', message: err.message });
  }

  // 5. Build partial response and send immediately
  const partial = buildResponse(location, allStores, allDeals, errors);
  const jobStatus = cache.jobStatus(zip, radiusMiles);

  res.json({
    ...partial,
    aiReady: false,
    aiStatus: jobStatus === 'running' ? 'running' : 'starting',
  });

  // 6. Kick off Vision enrichment in background (don't await)
  if (jobStatus !== 'running' && jobStatus !== 'done') {
    cache.setJobStatus(zip, radiusMiles, 'running');
    runVisionEnrichment(
      zip, radiusMiles, location,
      allStores.filter(s => s.source === 'kroger'),
      flippPartialStores,
      errors
    ).catch(err => {
      console.error('[BG] Vision enrichment failed:', err.message);
      cache.setJobStatus(zip, radiusMiles, 'error');
    });
  }
});

// ─── GET /api/deals/status?zip=30518&radius=10 ───────────────────────────────
// Frontend polls this to know when Vision is done and full results are ready.
router.get('/status', (req, res) => {
  const { zip, radius } = req.query;
  const radiusMiles = parseFloat(radius) || 10;
  const status = cache.jobStatus(zip, radiusMiles);
  const cached = cache.get(zip, radiusMiles);
  if (cached) return res.json({ aiReady: true, ...cached });
  res.json({ aiReady: false, aiStatus: status });
});

// ─── Background Vision enrichment ────────────────────────────────────────────
async function runVisionEnrichment(zip, radiusMiles, location, krogerStores, flippStores, existingErrors) {
  const { lat, lng } = location;
  const allStores = [...krogerStores, ...flippStores];
  const allDeals  = [];
  const errors    = [...existingErrors];

  // Re-fetch Kroger deals (they're fast and already cached in memory)
  try {
    const results = await Promise.allSettled(
      krogerStores.slice(0, 5).map(s => kroger.getDealsForStore(s))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') allDeals.push(...r.value);
    }
  } catch (err) {
    errors.push({ source: 'Kroger', message: err.message });
  }

  // Flipp with full Vision enrichment
  try {
    const { stores: fs, deals: fd } = await flipp.getDealsNearZip(
      zip, lat, lng, radiusMiles, location.city, location.state,
      { visionEnabled: true }
    );
    // Replace partial flipp stores with enriched versions
    const enrichedIds = new Set(fs.map(s => s.id));
    const filteredStores = allStores.filter(s => s.source !== 'flipp' || !enrichedIds.has(s.id));
    allStores.length = 0;
    allStores.push(...filteredStores, ...fs);
    allDeals.push(...fd);
  } catch (err) {
    errors.push({ source: 'Flipp AI', message: err.message });
    // Fall back to partial flipp deals
    try {
      const { deals: fd } = await flipp.getDealsNearZip(
        zip, lat, lng, radiusMiles, location.city, location.state,
        { visionEnabled: false }
      );
      allDeals.push(...fd);
    } catch {}
  }

  const result = buildResponse(location, allStores, allDeals, errors);
  cache.set(zip, radiusMiles, result);
  console.log(`[BG] Vision enrichment done for ${zip}: ${result.totalDeals} deals`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildResponse(location, stores, deals, errors) {
  const seenIds = new Set();
  const unique  = deals.filter(d => { if (seenIds.has(d.id)) return false; seenIds.add(d.id); return true; });

  const storeMap = {};
  for (const s of stores) storeMap[s.id] = { ...s, deals: [] };
  for (const d of unique) { if (storeMap[d.storeId]) storeMap[d.storeId].deals.push(d); }

  const storeList = Object.values(storeMap)
    .filter(s => s.deals.length > 0)
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  return {
    location,
    stores: storeList,
    totalDeals: unique.length,
    errors: errors.length ? errors : undefined,
  };
}

module.exports = router;
