import React, { useState } from 'react';

const RADIUS_OPTIONS = [5, 10, 15, 25, 50];

export default function LandingPage({ onSearch }) {
  const [zip, setZip] = useState('');
  const [radius, setRadius] = useState(10);
  const [zipError, setZipError] = useState('');

  function validate() {
    if (!/^\d{5}$/.test(zip.trim())) {
      setZipError('Please enter a valid 5-digit ZIP code.');
      return false;
    }
    setZipError('');
    return true;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (validate()) onSearch({ zip: zip.trim(), radius });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-green-50 flex flex-col">
      {/* Header */}
      <header className="py-6 px-6 flex justify-center">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🛒</span>
          <span className="text-xl font-bold text-brand-700 tracking-tight">GroceryDeals Near Me</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            Find Today's Best<br />
            <span className="text-brand-600">Grocery Deals</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-md mx-auto">
            Enter your ZIP code and we'll search every nearby grocery store for today's sales, discounts, and specials — all in one place.
          </p>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md p-8">
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="zip">
                ZIP Code
              </label>
              <input
                id="zip"
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zip}
                onChange={(e) => { setZip(e.target.value); setZipError(''); }}
                placeholder="e.g. 30518"
                className={`w-full px-4 py-3 rounded-xl border text-gray-900 text-lg placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 transition ${
                  zipError ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'
                }`}
              />
              {zipError && (
                <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                  <span>⚠</span> {zipError}
                </p>
              )}
            </div>

            <div className="mb-7">
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="radius">
                Search Radius
              </label>
              <select
                id="radius"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 transition cursor-pointer"
              >
                {RADIUS_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r} miles</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-lg font-bold shadow-md transition-all duration-150 flex items-center justify-center gap-2"
            >
              <span>🔍</span> Find Deals
            </button>
          </form>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          {['Kroger & Family', 'Walmart', 'Publix', 'Safeway', 'ALDI', 'Whole Foods', '+ more'].map((chain) => (
            <span key={chain} className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-500 shadow-sm">
              {chain}
            </span>
          ))}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-gray-400">
        Deals sourced from Kroger API &amp; Flipp · Updated daily
      </footer>
    </div>
  );
}
