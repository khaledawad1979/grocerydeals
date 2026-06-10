import React from 'react';

const SOURCE_BADGE = {
  kroger: 'bg-blue-50 text-blue-600',
  flipp:  'bg-purple-50 text-purple-600',
};

export default function PriceComparisonView({ deals, query }) {
  if (deals.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-4xl mb-3">🔍</div>
        <p>No deals found matching <strong>"{query}"</strong> across any nearby store.</p>
        <p className="text-sm mt-1">Try a shorter or different search term.</p>
      </div>
    );
  }

  const cheapest = deals[0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-500">
          <span className="font-bold text-gray-800">{deals.length}</span> matching deals — sorted cheapest first
        </span>
        {cheapest.salePrice != null && (
          <span className="px-3 py-1 bg-brand-100 text-brand-700 text-xs font-bold rounded-full">
            🏆 Best price: ${cheapest.salePrice.toFixed(2)} at {cheapest.storeName}
          </span>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {deals.map((deal, idx) => {
          const isBest = idx === 0 && deal.salePrice != null;
          return (
            <div
              key={deal.id}
              className={`flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-0 ${
                isBest ? 'bg-brand-50' : ''
              }`}
            >
              {/* Rank */}
              <span className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                isBest ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {idx + 1}
              </span>

              {/* Image */}
              {deal.imageUrl ? (
                <img src={deal.imageUrl} alt={deal.name}
                  className="w-14 h-14 object-contain rounded-lg bg-gray-50 flex-shrink-0"
                  onError={(e) => { e.target.style.display = 'none'; }} />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
                  {categoryEmoji(deal.category)}
                </div>
              )}

              {/* Name + store */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{deal.name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-gray-500">{deal.storeName}</span>
                  {deal.unit && <span className="text-xs text-gray-400">· {deal.unit}</span>}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SOURCE_BADGE[deal.source] || 'bg-gray-100 text-gray-500'}`}>
                    {deal.source === 'kroger' ? 'Kroger' : 'Flipp'}
                  </span>
                </div>
              </div>

              {/* Price */}
              <div className="text-right flex-shrink-0">
                {deal.salePrice != null ? (
                  <>
                    <p className={`text-xl font-extrabold ${isBest ? 'text-brand-600' : 'text-gray-800'}`}>
                      ${deal.salePrice.toFixed(2)}
                    </p>
                    {deal.originalPrice != null && deal.originalPrice > deal.salePrice && (
                      <p className="text-xs text-gray-400 line-through">${deal.originalPrice.toFixed(2)}</p>
                    )}
                    {deal.discountPct != null && deal.discountPct > 0 && (
                      <p className="text-xs font-bold text-brand-600">-{deal.discountPct}%</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400 italic">See store</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function categoryEmoji(cat) {
  const map = {
    'Produce': '🥦', 'Dairy & Eggs': '🥛', 'Meat & Seafood': '🥩',
    'Bakery': '🍞', 'Frozen': '🧊', 'Beverages': '🥤',
    'Snacks': '🍿', 'Breakfast': '🥣', 'Deli': '🧀',
    'Health & Beauty': '🧴', 'Household': '🧹',
  };
  return map[cat] || '🛒';
}
