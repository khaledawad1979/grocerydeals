import React, { useState, useRef } from 'react';

export default function ShoppingListPage({ search, onBack }) {
  const [input, setInput]     = useState('');
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan]       = useState(null);
  const [error, setError]     = useState(null);
  const inputRef = useRef(null);

  function addItem() {
    const val = input.trim();
    if (!val) return;
    const newItems = val.split(',').map(s => s.trim()).filter(Boolean);
    setItems(prev => {
      const merged = [...prev];
      for (const i of newItems) {
        if (!merged.some(x => x.toLowerCase() === i.toLowerCase())) merged.push(i);
      }
      return merged;
    });
    setInput('');
    setPlan(null);
    inputRef.current?.focus();
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
    setPlan(null);
  }

  async function optimize() {
    if (items.length === 0) return;
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const res  = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, zip: search?.zip, radius: search?.radius || 10 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to optimize.');
      setPlan(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm px-4 py-4 flex items-center gap-3 safe-top sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <span className="text-sm font-bold text-gray-800">Shopping List</span>
        {search?.zip && (
          <span className="ml-auto text-xs text-gray-400">📍 {search.zip} · {search.radius || 10} mi</span>
        )}
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Item input */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Add items to your list</p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="e.g. milk, eggs, chicken breast"
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={addItem}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-gray-400">Tip: add multiple items separated by commas</p>
        </div>

        {/* Item chips */}
        {items.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{items.length} item{items.length !== 1 ? 's' : ''}</p>
              <button onClick={() => { setItems([]); setPlan(null); }} className="text-xs text-red-400 hover:text-red-600">Clear all</button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {items.map((item, idx) => (
                <span key={idx} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 rounded-full text-sm font-medium border border-brand-100">
                  {item}
                  <button onClick={() => removeItem(idx)} className="text-brand-400 hover:text-brand-700 leading-none text-base">×</button>
                </span>
              ))}
            </div>
            <button
              onClick={optimize}
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Finding best prices…
                </>
              ) : '🛒 Optimize My List'}
            </button>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
        )}

        {/* Results */}
        {plan && <PlanResults plan={plan} />}
      </main>
    </div>
  );
}

function PlanResults({ plan }) {
  const { stores, unmatched, optimizedTotal, singleStoreTotal, savings, itemCount } = plan;

  return (
    <div className="space-y-4">

      {/* Summary banner */}
      <div className={`rounded-2xl p-5 ${savings > 0 ? 'bg-brand-600 text-white' : 'bg-gray-800 text-white'}`}>
        <p className="text-xs font-bold uppercase tracking-widest opacity-75 mb-1">Optimized total</p>
        <p className="text-4xl font-extrabold">${optimizedTotal.toFixed(2)}</p>
        {savings > 0 ? (
          <p className="text-sm mt-2 opacity-90">
            💰 You save <strong>${savings.toFixed(2)}</strong> vs buying everything at one store (${singleStoreTotal.toFixed(2)})
          </p>
        ) : (
          <p className="text-sm mt-2 opacity-75">Best prices across {stores.length} store{stores.length !== 1 ? 's' : ''} · {itemCount} item{itemCount !== 1 ? 's' : ''} matched</p>
        )}
      </div>

      {/* Per-store breakdown */}
      {stores.map((store, si) => (
        <div key={store.storeId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${si === 0 ? 'bg-brand-600' : 'bg-gray-400'}`}>
                {si + 1}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{store.storeName}</p>
                <p className="text-xs text-gray-400">{store.items.length} item{store.items.length !== 1 ? 's' : ''} here</p>
              </div>
            </div>
            <p className="text-lg font-extrabold text-gray-900">${store.total.toFixed(2)}</p>
          </div>

          {store.items.map((entry, i) => (
            <div key={i} className={`flex items-center justify-between px-5 py-3 ${i < store.items.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <div className="flex items-center gap-3 min-w-0">
                {entry.deal.imageUrl ? (
                  <img src={entry.deal.imageUrl} alt="" className="w-10 h-10 object-contain rounded-lg bg-gray-50 flex-shrink-0"
                    onError={e => e.target.style.display='none'} />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">🛒</div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{entry.deal.name}</p>
                  <p className="text-xs text-gray-400 truncate">looking for: {entry.query}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <p className="text-sm font-bold text-brand-600">${entry.deal.salePrice.toFixed(2)}</p>
                {entry.deal.originalPrice && (
                  <p className="text-xs text-gray-400 line-through">${entry.deal.originalPrice.toFixed(2)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Unmatched items */}
      {unmatched.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ No deals found this week for:</p>
          <div className="flex flex-wrap gap-2">
            {unmatched.map((item, i) => (
              <span key={i} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">{item}</span>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-2">These items may not be on sale at any nearby store this week.</p>
        </div>
      )}
    </div>
  );
}
