import React, { useState } from 'react';
import LandingPage from './pages/LandingPage';
import ResultsPage from './pages/ResultsPage';

export default function App() {
  const [search, setSearch] = useState(null); // { zip, radius }
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSearch({ zip, radius }) {
    setLoading(true);
    setError(null);
    setResults(null);
    setSearch({ zip, radius });

    try {
      const res = await fetch(`/api/deals?zip=${encodeURIComponent(zip)}&radius=${radius}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch deals.');
      }
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSearch(null);
    setResults(null);
    setError(null);
    setLoading(false);
  }

  if (!search && !loading) {
    return <LandingPage onSearch={handleSearch} />;
  }

  return (
    <ResultsPage
      search={search}
      results={results}
      loading={loading}
      error={error}
      onReset={handleReset}
      onSearch={handleSearch}
    />
  );
}
