/**
 * Returns a direct URL for a deal item:
 *  - Kroger: official product page (kroger.com/p/{slug}/{id})
 *  - Flipp stores: store-specific search page, or Google Shopping fallback
 */
export function getItemUrl(deal) {
  const name  = deal.name  || '';
  const chain = (deal.storeChain || deal.storeName || '').toLowerCase();
  const enc   = encodeURIComponent(name);

  // ── Kroger API items ──────────────────────────────────────────────────────
  if (deal.source === 'kroger') {
    const productId = deal.id.replace('kroger-', '');
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    return `https://www.kroger.com/p/${slug}/${productId}`;
  }

  // ── Flipp items — route by chain name ────────────────────────────────────
  if (chain.includes('publix'))
    return `https://www.publix.com/shop/search?searchTerm=${enc}`;

  if (chain.includes('walmart'))
    return `https://www.walmart.com/search?q=${enc}`;

  if (chain.includes('target'))
    return `https://www.target.com/s?searchTerm=${enc}`;

  if (chain.includes('costco'))
    return `https://www.costco.com/CatalogSearch?keyword=${enc}`;

  if (chain.includes('sprouts'))
    return `https://www.sprouts.com/search/?search=${enc}`;

  if (chain.includes('food lion'))
    return `https://www.foodlion.com/search?query=${enc}`;

  if (chain.includes('dollar general'))
    return `https://www.dollargeneral.com/search#q=${enc}`;

  if (chain.includes('family dollar'))
    return `https://www.familydollar.com/en-us/search?q=${enc}`;

  if (chain.includes('kroger'))
    return `https://www.kroger.com/search?query=${enc}`;

  if (chain.includes('whole foods'))
    return `https://www.wholefoodsmarket.com/search?text=${enc}`;

  if (chain.includes('safeway'))
    return `https://www.safeway.com/shop/search-results.html?q=${enc}`;

  if (chain.includes('albertsons'))
    return `https://www.albertsons.com/shop/search-results.html?q=${enc}`;

  if (chain.includes('wegmans'))
    return `https://www.wegmans.com/search/#q=${enc}`;

  if (chain.includes('meijer'))
    return `https://www.meijer.com/shopping/search.html?search=${enc}`;

  if (chain.includes('heb') || chain.includes('h-e-b'))
    return `https://www.heb.com/search/?q=${enc}`;

  if (chain.includes('trader joe'))
    return `https://www.traderjoes.com/home/search?q=${enc}&global=yes`;

  if (chain.includes('earth fare'))
    return `https://www.earthfare.com/search?q=${enc}`;

  if (chain.includes('lowes foods'))
    return `https://www.lowesfoods.com/search?q=${enc}`;

  if (chain.includes('ingles'))
    return `https://www.ingles-markets.com/search?q=${enc}`;

  if (chain.includes('h mart') || chain.includes('hmart'))
    return `https://www.hmart.com/search?q=${enc}`;

  if (chain.includes('restaurant depot'))
    return `https://www.restaurantdepot.com/search?q=${enc}`;

  // ALDI & Lidl don't have traditional product search — use Google Shopping
  if (chain.includes('aldi'))
    return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(name + ' ALDI')}`;

  if (chain.includes('lidl'))
    return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(name + ' Lidl')}`;

  // Universal fallback: Google Shopping
  const storeHint = deal.storeName ? ` ${deal.storeName}` : '';
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(name + storeHint)}`;
}
