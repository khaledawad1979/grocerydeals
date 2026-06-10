/**
 * Returns a clickable URL for a deal item:
 *  - Kroger source → direct product page on kroger.com (official API gives exact product ID)
 *  - Flipp source  → Google Shopping search for the item at that store (most reliable,
 *                    store websites vary wildly and often require login or have CAPTCHA)
 */
export function getItemUrl(deal) {
  // ── Kroger: exact product page ────────────────────────────────────────────
  if (deal.source === 'kroger') {
    const productId = deal.id.replace('kroger-', '');
    const slug = (deal.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    return `https://www.kroger.com/p/${slug}/${productId}`;
  }

  // ── Flipp: Google Shopping search — item name + store name ───────────────
  // This is the most reliable cross-store approach: no login, no CAPTCHA,
  // no broken store-specific URL formats.
  const query = [deal.name, deal.storeName].filter(Boolean).join(' ');
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
}
