/**
 * Store locator — finds the nearest branch of a merchant using OpenStreetMap's
 * Nominatim geocoder (free, no key, max 1 request/second).
 *
 * Results are cached in memory per merchant+zip since store locations are static.
 */
const axios = require('axios');
const { haversine } = require('../utils/haversine');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT    = 'GroceryDealsApp/1.0 (grocerydeals-production.up.railway.app)';

const cache = new Map(); // "merchant:zip" → { lat, lng, address, distance } | null

// Serialise requests so we never exceed 1 req/sec
let queue = Promise.resolve();
function rateLimited(fn) {
  const next = queue.then(fn).then(
    async (v) => { await sleep(1100); return v; },
    async (e) => { await sleep(1100); throw e; }
  );
  // keep queue alive even on errors
  queue = next.catch(() => {});
  return next;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Find the nearest branch of `merchantName` to (lat, lng) within radiusMiles.
 * Returns { lat, lng, address, distance } or null if not found.
 */
async function locateStore(merchantName, zip, lat, lng, radiusMiles) {
  const key = `${merchantName.toLowerCase()}:${zip}:${radiusMiles}`;
  if (cache.has(key)) return cache.get(key);

  // Bounding box around the ZIP centre (~1 deg lat = 69mi, lng = ~55mi at US latitudes)
  const dLat = radiusMiles / 69;
  const dLng = radiusMiles / 55;
  const viewbox = `${lng - dLng},${lat + dLat},${lng + dLng},${lat - dLat}`;

  let result = null;
  try {
    const res = await rateLimited(() =>
      axios.get(NOMINATIM_URL, {
        params: {
          q: merchantName,
          format: 'json',
          viewbox,
          bounded: 1,
          limit: 5,
          addressdetails: 1,
        },
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000,
      })
    );

    // Pick the nearest hit (Nominatim sorts by importance, not distance)
    let best = null;
    for (const hit of res.data || []) {
      const hLat = parseFloat(hit.lat);
      const hLng = parseFloat(hit.lon);
      const dist = haversine(lat, lng, hLat, hLng);
      if (dist <= radiusMiles && (!best || dist < best.distance)) {
        const a = hit.address || {};
        best = {
          lat: hLat,
          lng: hLng,
          distance: dist,
          address: [a.house_number, a.road, a.town || a.city || a.village, a.state, a.postcode]
            .filter(Boolean)
            .join(', '),
        };
      }
    }
    result = best;
  } catch (err) {
    console.warn(`[StoreLocator] ${merchantName}: ${err.message}`);
  }

  cache.set(key, result);
  return result;
}

module.exports = { locateStore };
