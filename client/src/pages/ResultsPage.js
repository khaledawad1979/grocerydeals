import React, { useState, useMemo, useRef } from 'react';
import Spinner from '../components/Spinner';
import FilterBar from '../components/FilterBar';
import StoreSection from '../components/StoreSection';
import PriceComparisonView from '../components/PriceComparisonView';

const RADIUS_OPTIONS = [5, 10, 15, 25, 50];

export default function ResultsPage({ search, results, loading, error, aiReady, onReset, onSearch }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeStore, setActiveStore]       = useState('All');
  const [itemQuery, setItemQuery]           = useState('');
  const [zip, setZip]     = useState(search?.zip || '');
  const [radius, setRadius] = useState(search?.radius || 10);
  const searchInputRef = useRef(null);

  // Derive available categories
  const categories = useMemo(() => {
    if (!results?.stores) return [];
    const s = new Set();
    for (const store of results.stores)
      for (const deal of store.deals || [])
        if (deal.category) s.add(deal.category);
    return Array.from(s).sort();
  }, [results]);

  // All deals flat, filtered by item name query + category + store, sorted cheapest first
  const searchResults = useMemo(() => {
    if (!itemQuery.trim() || !results?.stores) return null;
    const q = itemQuery.toLowerCase().trim();
    const matched = [];
    for (const store of results.stores) {
      if (activeStore !== 'All' && store.name !== activeStore) continue;
      for (const deal of store.deals || []) {
        const nameMatch = deal.name?.toLowerCase().includes(q) ||
                          deal.brand?.toLowerCase().includes(q);
        const catMatch  = activeCategory === 'All' || deal.category === activeCategory;
        if (nameMatch && catMatch) matched.push(deal);
      }
    }
    return matched.sort((a, b) => {
      if (a.salePrice != null && b.salePrice != null) return a.salePrice - b.salePrice;
      if (a.salePrice != null) return -1;
      if (b.salePrice != null) return 1;
      return 0;
    });
  }, [itemQuery, activeCategory, activeStore, results]);

  function handleSubmit(e) {
    e.preventDefault();
    if (/^\d{5}$/.test(zip.trim())) {
      setActiveCategory('All');
      setActiveStore('All');
      setItemQuery('');
      onSearch({ zip: zip.trim(), radius });
    }
  }

  function clearSearch() {
    setItemQuery('');
    searchInputRef.current?.focus();
  }

  const storeNames = useMemo(() => {
    if (!results?.stores) return [];
    return results.stores.filter((s) => s.deals?.length > 0).map((s) => s.name);
  }, [results]);

  const storesWithDeals = results?.stores?.filter((s) => {
    if (s.deals?.length === 0) return false;
    if (activeStore !== 'All' && s.name !== activeStore) return false;
    if (activeCategory === 'All') return true;
    return s.deals?.some((d) => d.category === activeCategory);
  }) || [];

  const isSearching = !!itemQuery.trim();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <button onClick={onReset} className="flex items-center gap-1.5 flex-shrink-0 group">
            <span className="text-2xl">🛒</span>
            <span className="font-bold text-brand-700 text-sm hidden sm:inline group-hover:underline">
              GroceryDeals Near Me
            </span>
          </button>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-1 max-w-xl ml-2">
            <input
              type="text" inputMode="numeric" maxLength={5} value={zip}
              onChange={(e) => setZip(e.target.value)} placeholder="ZIP code"
              className="w-24 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer">
              {RADIUS_OPTIONS.map((r) => <option key={r} value={r}>{r} mi</option>)}
            </select>
            <button type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors">
              Search
            </button>
          </form>

          {results && !loading && (
            <div className="ml-auto flex-shrink-0 text-sm text-gray-500">
              <span className="font-bold text-brand-700">{results.totalDeals}</span> deals at{' '}
              <span className="font-bold text-brand-700">{results.stores?.length}</span> stores
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading && <Spinner message={`Searching grocery stores near ${search?.zip}…`} />}

        {!loading && error && (
          <div className="max-w-lg mx-auto mt-16 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
            <p className="text-gray-500 mb-6">{error}</p>
            <button onClick={onReset} className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors">Try Again</button>
          </div>
        )}

        {!loading && results && (
          <>
            {/* Location banner */}
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
              <span>📍</span>
              <span>
                {results.location?.city}, {results.location?.state} ({search?.zip}) ·{' '}
                {search?.radius}-mile radius ·{' '}
                <span className="text-brand-700 font-semibold">{results.totalDeals} deals found today</span>
              </span>
            </div>

            {/* AI enrichment banners */}
            {!aiReady && results?.stores?.length > 0 && (
              <div className="mb-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 flex items-center gap-3">
                <svg className="animate-spin h-4 w-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <span><strong>AI agent running</strong> — Claude is reading flyer images to extract more deals. Results update automatically in ~60s.</span>
              </div>
            )}
            {aiReady && results?.stores?.some(s => s.source === 'flipp' && s.deals?.length > 1) && (
              <div className="mb-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-center gap-2">
                <span>✨</span>
                <span><strong>AI enrichment complete</strong> — all flyer items extracted by Claude Vision.</span>
              </div>
            )}

            {/* API errors */}
            {results.errors?.map((e) => (
              <div key={e.source} className="mb-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-2">
                <span className="flex-shrink-0">⚠️</span>
                <span><strong>{e.source}</strong> data unavailable: {e.message}. Results from other sources are still shown.</span>
              </div>
            ))}

            {results.stores?.length === 0 && (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">🔍</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">No stores found nearby</h2>
                <p className="text-gray-500 mb-2">{results.message || `No grocery stores found within ${search?.radius} miles of ${search?.zip}.`}</p>
                <p className="text-gray-400 text-sm">Try increasing your search radius.</p>
              </div>
            )}

            {/* ── Filter panel: item search + category pills ── */}
            {results.stores?.length > 0 && (
              <div className="mb-5 bg-white rounded-xl border border-gray-100 shadow-sm px-4 pt-3 pb-3 space-y-3">

                {/* Item search */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={itemQuery}
                    onChange={(e) => setItemQuery(e.target.value)}
                    placeholder="Search items across all stores… e.g. chicken, milk, pizza"
                    className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                  />
                  {itemQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
                    >×</button>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Store filter pills */}
                <div className="flex flex-wrap gap-2">
                  {['All', ...storeNames].map((name) => (
                    <button
                      key={name}
                      onClick={() => setActiveStore(name)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                        activeStore === name
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {name === 'All' ? '🏪 All Stores' : name}
                    </button>
                  ))}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Category pills */}
                <FilterBar categories={categories} active={activeCategory} onChange={(cat) => { setActiveCategory(cat); }} />
              </div>
            )}

            {/* ── Price comparison view (when searching) ── */}
            {isSearching && searchResults !== null && (
              <PriceComparisonView deals={searchResults} query={itemQuery} />
            )}

            {/* ── Store sections (when not searching) ── */}
            {!isSearching && (
              <>
                {storesWithDeals.map((store) => (
                  <StoreSection key={store.id} store={store} activeCategory={activeCategory} />
                ))}
                {activeCategory !== 'All' && storesWithDeals.length === 0 && results.stores?.length > 0 && (
                  <div className="text-center py-16 text-gray-400">
                    <div className="text-4xl mb-3">🔎</div>
                    <p>No <strong>{activeCategory}</strong> deals found at any nearby store today.</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
