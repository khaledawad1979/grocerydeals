import React, { useState, useMemo } from 'react';
import Spinner from '../components/Spinner';
import FilterBar from '../components/FilterBar';
import StoreSection from '../components/StoreSection';

const RADIUS_OPTIONS = [5, 10, 15, 25, 50];

export default function ResultsPage({ search, results, loading, error, onReset, onSearch }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [zip, setZip] = useState(search?.zip || '');
  const [radius, setRadius] = useState(search?.radius || 10);

  // Derive available categories from all deals
  const categories = useMemo(() => {
    if (!results?.stores) return [];
    const catSet = new Set();
    for (const store of results.stores) {
      for (const deal of store.deals || []) {
        if (deal.category) catSet.add(deal.category);
      }
    }
    return Array.from(catSet).sort();
  }, [results]);

  function handleSubmit(e) {
    e.preventDefault();
    if (/^\d{5}$/.test(zip.trim())) {
      setActiveCategory('All');
      onSearch({ zip: zip.trim(), radius });
    }
  }

  const storesWithDeals = results?.stores?.filter((s) =>
    activeCategory === 'All'
      ? s.deals?.length > 0
      : s.deals?.some((d) => d.category === activeCategory)
  ) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          {/* Logo */}
          <button onClick={onReset} className="flex items-center gap-1.5 flex-shrink-0 group">
            <span className="text-2xl">🛒</span>
            <span className="font-bold text-brand-700 text-sm hidden sm:inline group-hover:underline">
              GroceryDeals Near Me
            </span>
          </button>

          {/* Inline search form */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-1 max-w-xl ml-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="ZIP code"
              className="w-24 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
            >
              {RADIUS_OPTIONS.map((r) => <option key={r} value={r}>{r} mi</option>)}
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Search
            </button>
          </form>

          {/* Summary badge */}
          {results && !loading && (
            <div className="ml-auto flex-shrink-0 text-sm text-gray-500">
              <span className="font-bold text-brand-700">{results.totalDeals}</span> deals at{' '}
              <span className="font-bold text-brand-700">{results.stores?.length}</span> stores
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Loading */}
        {loading && (
          <Spinner message={`Searching grocery stores near ${search?.zip}…`} />
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="max-w-lg mx-auto mt-16 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
            <p className="text-gray-500 mb-6">{error}</p>
            <button
              onClick={onReset}
              className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Results */}
        {!loading && results && (
          <>
            {/* Location banner */}
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
              <span>📍</span>
              <span>
                {results.location?.city}, {results.location?.state} ({search?.zip}) ·{' '}
                {search?.radius}-mile radius ·{' '}
                <span className="text-brand-700 font-semibold">
                  {results.totalDeals} deals found today
                </span>
              </span>
            </div>

            {/* API error warnings (partial results) */}
            {results.errors?.map((e) => (
              <div key={e.source} className="mb-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-2">
                <span className="flex-shrink-0">⚠️</span>
                <span>
                  <strong>{e.source}</strong> data unavailable: {e.message}.
                  Results from other sources are still shown.
                </span>
              </div>
            ))}

            {/* No stores found */}
            {results.stores?.length === 0 && (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">🔍</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">No stores found nearby</h2>
                <p className="text-gray-500 mb-2">
                  {results.message || `No grocery stores found within ${search?.radius} miles of ${search?.zip}.`}
                </p>
                <p className="text-gray-400 text-sm">Try increasing your search radius.</p>
              </div>
            )}

            {/* Filter bar */}
            {results.stores?.length > 0 && (
              <div className="mb-5 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                <FilterBar
                  categories={categories}
                  active={activeCategory}
                  onChange={setActiveCategory}
                />
              </div>
            )}

            {/* Store sections */}
            {storesWithDeals.map((store) => (
              <StoreSection
                key={store.id}
                store={store}
                activeCategory={activeCategory}
              />
            ))}

            {/* Category filter returned nothing */}
            {activeCategory !== 'All' && storesWithDeals.length === 0 && results.stores?.length > 0 && (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">🔎</div>
                <p>No <strong>{activeCategory}</strong> deals found at any nearby store today.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
