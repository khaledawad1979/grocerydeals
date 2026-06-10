import React, { useState } from 'react';
import DealCard from './DealCard';

export default function StoreSection({ store, activeCategory }) {
  const [open, setOpen] = useState(true);

  const filteredDeals = activeCategory === 'All'
    ? store.deals
    : store.deals.filter((d) => d.category === activeCategory);

  const sourceLabel = store.source === 'kroger' ? '🔵 Kroger' : '🟣 Flipp';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
      {/* Store header — click to collapse */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl flex-shrink-0">🏪</span>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-base leading-tight truncate">{store.name}</p>
            <p className="text-sm text-gray-400 truncate">{store.address}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {store.distance != null && (
            <span className="hidden sm:inline text-xs text-gray-400 font-medium">
              {store.distance.toFixed(1)} mi away
            </span>
          )}
          <span className="px-2 py-0.5 bg-brand-100 text-brand-700 text-xs font-bold rounded-full">
            {filteredDeals.length} deals
          </span>
          <span className="text-xs text-gray-400">{sourceLabel}</span>
          <span className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>

      {/* Deals grid */}
      {open && (
        <div className="px-5 pb-5">
          {filteredDeals.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              No deals match the selected category at this store.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
