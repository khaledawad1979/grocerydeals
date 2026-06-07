import React from 'react';

const CATEGORY_EMOJI = {
  'All': '🛒',
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

export default function FilterBar({ categories, active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {['All', ...categories].map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
            active === cat
              ? 'bg-brand-600 text-white shadow-md'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-400 hover:text-brand-600'
          }`}
        >
          <span>{CATEGORY_EMOJI[cat] || '📦'}</span>
          {cat}
        </button>
      ))}
    </div>
  );
}
