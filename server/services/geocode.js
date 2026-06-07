const axios = require('axios');

/**
 * Convert a US ZIP code to { lat, lng, city, state } using Zippopotam.us (no API key needed).
 */
async function zipToLatLng(zip) {
  const cleaned = String(zip).trim();
  if (!/^\d{5}$/.test(cleaned)) {
    throw Object.assign(new Error('Invalid ZIP code — must be a 5-digit US ZIP.'), { code: 'INVALID_ZIP' });
  }

  let res;
  try {
    res = await axios.get(`https://api.zippopotam.us/us/${cleaned}`, { timeout: 8000 });
  } catch (err) {
    if (err.response?.status === 404) {
      throw Object.assign(new Error(`ZIP code ${cleaned} not found.`), { code: 'ZIP_NOT_FOUND' });
    }
    throw Object.assign(new Error('Geocoding service unavailable.'), { code: 'GEOCODE_ERROR' });
  }

  const place = res.data.places?.[0];
  if (!place) {
    throw Object.assign(new Error(`No location data for ZIP ${cleaned}.`), { code: 'ZIP_NOT_FOUND' });
  }

  return {
    lat: parseFloat(place.latitude),
    lng: parseFloat(place.longitude),
    city: place['place name'],
    state: place['state abbreviation'],
  };
}

module.exports = { zipToLatLng };
