import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

export default function ProfilePage({ onBack }) {
  const { user, logout } = useAuth0();

  if (!user) return null;

  const joined = new Date(user.updated_at || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm px-4 py-4 flex items-center gap-3 safe-top">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <span className="text-sm font-bold text-gray-800">My Profile</span>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-4">

        {/* Avatar + name card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center">
          {user.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="w-20 h-20 rounded-full object-cover border-4 border-brand-100 mb-4"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-brand-600 flex items-center justify-center text-white text-3xl font-bold mb-4">
              {(user.name || user.email || '?')[0].toUpperCase()}
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
          {user.given_name && user.family_name && (
            <p className="text-sm text-gray-400 mt-0.5">{user.given_name} {user.family_name}</p>
          )}
        </div>

        {/* Info rows */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <InfoRow label="Email" value={user.email} icon="✉️" />
          <InfoRow label="Login method" value={loginMethod(user.sub)} icon="🔐" />
          <InfoRow label="Email verified" value={user.email_verified ? 'Yes' : 'No'} icon="✅" />
          <InfoRow label="Account created" value={joined} icon="📅" last />
        </div>

        {/* Sign out */}
        <button
          onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          className="w-full py-3.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-2xl border border-red-100 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>

      </main>
    </div>
  );
}

function InfoRow({ label, value, icon, last }) {
  return (
    <div className={`flex items-center gap-4 px-5 py-4 ${!last ? 'border-b border-gray-50' : ''}`}>
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
      </div>
    </div>
  );
}

function loginMethod(sub) {
  if (!sub) return 'Unknown';
  if (sub.startsWith('google-oauth2')) return 'Google';
  if (sub.startsWith('apple')) return 'Apple';
  if (sub.startsWith('auth0')) return 'Email';
  return 'Social login';
}
