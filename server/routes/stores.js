const express = require('express');
const router = express.Router();
const { zipToLatLng } = require('../services/geocode');
const kroger = require('../services/kroger');
const flipp = require('../services/flipp');
const { haversine } = require('../utils/haversine');

// GET /api/stores?zip=30518&radius=10
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
  const stores = [];
  const errors = [];

  // Kroger stores
  try {
    const krogerStores = await kroger.findStores(lat, lng, radiusMiles);
    stores.push(...krogerStores.filter((s) => s.distance <= radiusMiles));
  } catch (err) {
    errors.push({ source: 'kroger', message: err.message });
  }

  // Flipp stores (derived from flyers)
  try {
    const { stores: flippStores } = await flipp.getDealsNearZip(zip, lat, lng, radiusMiles);
    stores.push(...flippStores);
  } catch (err) {
    errors.push({ source: 'flipp', message: err.message });
  }

  stores.sort((a, b) => a.distance - b.distance);

  res.json({
    location,
    stores,
    totalStores: stores.length,
    errors: errors.length ? errors : undefined,
  });
});

module.exports = router;
