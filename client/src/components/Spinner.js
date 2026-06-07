import React from 'react';

export default function Spinner({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-brand-100" />
        <div className="absolute inset-0 rounded-full border-4 border-brand-600 border-t-transparent animate-spin" />
        <span className="absolute inset-0 flex items-center justify-center text-2xl">🛒</span>
      </div>
      <p className="text-gray-500 font-medium">{message}</p>
    </div>
  );
}
