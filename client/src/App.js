import React, { useState, useEffect, useRef } from 'react';
import LandingPage from './pages/LandingPage';
import ResultsPage from './pages/ResultsPage';

const POLL_INTERVAL = 6000; // ms between status polls

export default function App() {
  const [search, setSearch]   = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [error, setError]     = useState(null);
  const pollRef = useRef(null);

  // Stop polling when component unmounts or search changes
  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  // Poll /api/deals/status until Vision enrichment is done
  function startPolling(zip, radius) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/deals/status?zip=${encodeURIComponent(zip)}&radius=${radius}`);
        const data = await res.json();
        if (data.aiReady && data.stores) {
          setResults(data);
          setAiReady(true);
          stopPolling();
        }
      } catch { /* silently ignore poll errors */ }
    }, POLL_INTERVAL);
  }

  useEffect(() => () => stopPolling(), []);

  async function handleSearch({ zip, radius }) {
    stopPolling();
    setLoading(true);
    setError(null);
    setResults(null);
    setAiReady(false);
    setSearch({ zip, radius });

    try {
      const res  = await fetch(`/api/deals?zip=${encodeURIComponent(zip)}&radius=${radius}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch deals.');

      setResults(data);
      setLoading(false);

      // If Vision enrichment is still running, start polling for full results
      if (!data.aiReady) {
        startPolling(zip, radius);
      } else {
        setAiReady(true);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  function handleReset() {
    stopPolling();
    setSearch(null);
    setResults(null);
    setError(null);
    setLoading(false);
    setAiReady(false);
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
      aiReady={aiReady}
      onReset={handleReset}
      onSearch={handleSearch}
    />
  );
}
