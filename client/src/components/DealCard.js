import React from 'react';

export default function DealCard({ deal }) {
  const {
    name, brand, category, imageUrl,
    originalPrice, salePrice, discountPct,
    unit, description, todayOnly, source,
    flyerUrl, isFlyerCard,
  } = deal;

  // Flyer-link card: no item pricing, just a link to the full ad
  if (isFlyerCard) {
    return (
      <a
        href={flyerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-white rounded-xl border border-purple-200 shadow-sm hover:shadow-md hover:border-purple-400 transition-all overflow-hidden flex flex-col group"
      >
        {imageUrl ? (
          <div className="h-32 bg-gray-50 flex items-center justify-center overflow-hidden">
            <img src={imageUrl} alt={name} className="h-full w-full object-contain p-2" onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
        ) : (
          <div className="h-24 bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center text-3xl">📰</div>
        )}
        <div className="p-3 flex flex-col flex-1">
          <p className="text-sm font-semibold text-gray-800 leading-snug mb-1">{name}</p>
          {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
          <div className="mt-auto pt-2 flex items-center gap-1 text-purple-600 text-xs font-semibold group-hover:underline">
            <span>View All Deals on Flipp →</span>
          </div>
        </div>
      </a>
    );
  }

  const hasPriceInfo = salePrice != null || originalPrice != null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Image */}
      {imageUrl ? (
        <div className="h-32 bg-gray-50 flex items-center justify-center overflow-hidden">
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-contain p-2"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      ) : (
        <div className="h-24 bg-gradient-to-br from-brand-50 to-green-50 flex items-center justify-center text-3xl">
          {categoryEmoji(category)}
        </div>
      )}

      <div className="p-3 flex flex-col flex-1">
        {/* Badges */}
        <div className="flex flex-wrap gap-1 mb-1.5">
          {todayOnly && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full uppercase tracking-wide">
              Today Only
            </span>
          )}
          {discountPct != null && discountPct > 0 && (
            <span className="px-2 py-0.5 bg-brand-100 text-brand-700 text-xs font-bold rounded-full">
              {discountPct}% OFF
            </span>
          )}
        </div>

        {/* Name */}
        <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2 mb-1">
          {name}
        </p>
        {brand && <p className="text-xs text-gray-400 mb-1">{brand}</p>}
        {unit && <p className="text-xs text-gray-400">{unit}</p>}
        {description && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{description}</p>
        )}

        {/* Price */}
        {hasPriceInfo && (
          <div className="mt-auto pt-2 flex items-end gap-2">
            {salePrice != null && (
              <span className="text-xl font-extrabold text-brand-600">
                ${salePrice.toFixed(2)}
              </span>
            )}
            {originalPrice != null && salePrice != null && originalPrice > salePrice && (
              <span className="text-sm text-gray-400 line-through">
                ${originalPrice.toFixed(2)}
              </span>
            )}
            {salePrice == null && originalPrice != null && (
              <span className="text-xl font-extrabold text-gray-700">
                ${originalPrice.toFixed(2)}
              </span>
            )}
          </div>
        )}

        {/* Source tag */}
        <div className="mt-2">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            source === 'kroger'
              ? 'bg-blue-50 text-blue-600'
              : 'bg-purple-50 text-purple-600'
          }`}>
            {source === 'kroger' ? 'Kroger' : 'Flipp'}
          </span>
        </div>
      </div>
    </div>
  );
}

function categoryEmoji(cat) {
  const map = {
    'Produce': '🥦',
    'Dairy & Eggs': '🥛',
    'Meat & Seafood': '🥩',
    'Bakery': '🍞',
    'Frozen': '🧊',
    'Beverages': '🥤',
    'Snacks': '🍿',
    'Breakfast': '🥣',
    'Deli': '🧀',
    'Health & Beauty': '🧴',
    'Household': '🧹',
    'Grocery': '🛒',
    'Other': '📦',
  };
  return map[cat] || '🛒';
}
