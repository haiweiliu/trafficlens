'use client';

import { useState, useRef, useEffect } from 'react';
import { normalizeDomains, parseDomains } from '@/lib/domain-utils';
import { TrafficData, TrafficResponse } from '@/types';
import TrafficTable from '@/components/TrafficTable';
import ExportButtons from '@/components/ExportButtons';

export default function Home() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<TrafficData[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [dryRun, setDryRun] = useState(false);
  const [bypassCache, setBypassCache] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleNormalize = () => {
    if (!input.trim()) return;
    try {
      const parsed = parseDomains(input);
      const normalized = normalizeDomains(parsed);
      const domains = normalized.map(d => d.domain);
      setInput(domains.join('\n'));
    } catch (error) {
      alert('Error normalizing domains');
    }
  };

  const handleRun = async () => {
    if (!input.trim()) {
      alert('Please enter at least one domain');
      return;
    }

    if (loading) {
      return;
    }

    setLoading(true);
    setProgress('Loading cached results...');
    setResults([]);

    try {
      const parsed = parseDomains(input);
      const normalized = normalizeDomains(parsed);
      const domainsToCheck = normalized.map(d => d.domain);

      if (domainsToCheck.length === 0) {
        alert('Please enter at least one valid domain');
        setLoading(false);
        return;
      }

      // Send all domains at once - backend returns cached immediately, scrapes missing in background
      const response = await fetch('/api/traffic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domains: domainsToCheck,
          dryRun,
          bypassCache,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch traffic data');
      }

      const data: TrafficResponse = await response.json();
      
      // Show cached results immediately
      setResults(data.results);
      
      const cacheHits = data.metadata.cacheHits;
      const cacheMisses = data.metadata.cacheMisses;
      
      if (cacheMisses > 0) {
        setProgress(`Showing ${cacheHits} cached results. Scraping ${cacheMisses} domains in background...`);
        
        const MAX_POLL_TIME = 120000; // 2 minutes max
        const POLL_INTERVAL = 2000; // Poll every 2 seconds
        const startTime = Date.now();
        let pollCount = 0;
        
        // Poll for updates every 2 seconds, max 2 minutes
        const pollInterval = setInterval(async () => {
          pollCount++;
          const elapsed = Date.now() - startTime;
          
          // Timeout after 2 minutes
          if (elapsed >= MAX_POLL_TIME) {
            clearInterval(pollInterval);
            setLoading(false);
            setProgress('Background scraping timed out (2 min). Some domains may still be processing. Refresh to check updates.');
            setTimeout(() => setProgress(''), 5000);
            return;
          }
          
          try {
            const updateResponse = await fetch(`/api/traffic/update?domains=${domainsToCheck.join(',')}`);
            if (updateResponse.ok) {
              const updateData = await updateResponse.json();
              
              // Merge updated results
              const updatedMap = new Map<string, TrafficData>(
                updateData.results.map((r: TrafficData) => [r.domain, r])
              );
              const mergedResults = data.results.map((result: TrafficData) => {
                const updated = updatedMap.get(result.domain);
                if (updated && updated.error && !updated.error.includes('Still scraping') && !updated.error.includes('Scraping in background')) {
                  return updated;
                } else if (updated && !updated.error) {
                  return updated;
                }
                return result;
              });
              
              setResults(mergedResults);
              
              // Check if all done (no "Still scraping" or "Scraping in background" errors)
              const stillScraping = mergedResults.some(r => 
                r.error?.includes('Still scraping') || 
                r.error?.includes('Scraping in background')
              );
              
              if (!stillScraping) {
                clearInterval(pollInterval);
                setProgress(`Completed! ${cacheHits} from cache, ${cacheMisses} scraped.`);
                setLoading(false);
                setTimeout(() => setProgress(''), 3000);
              } else {
                // Update progress with time remaining
                const remaining = Math.ceil((MAX_POLL_TIME - elapsed) / 1000);
                const completed = cacheMisses - mergedResults.filter(r => 
                  r.error?.includes('Still scraping') || r.error?.includes('Scraping in background')
                ).length;
                setProgress(`Showing ${cacheHits} cached results. Scraping ${cacheMisses} domains (${completed}/${cacheMisses} done, ${remaining}s remaining)...`);
              }
            }
          } catch (error) {
            console.error('Polling error:', error);
            // Don't stop polling on network errors, but log them
          }
        }, POLL_INTERVAL);
        
        // Store interval for cleanup
        pollIntervalRef.current = pollInterval;
      } else {
        setProgress(`All ${cacheHits} results from cache!`);
        setLoading(false);
        setTimeout(() => setProgress(''), 3000);
      }
    } catch (error) {
      console.error('Error:', error);
      alert(error instanceof Error ? error.message : 'An error occurred');
      setProgress('Error occurred');
      setLoading(false);
      setTimeout(() => setProgress(''), 3000);
    }
  };

  const handleClear = () => {
    setInput('');
    setResults([]);
    setProgress('');
    // Clear any ongoing polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setLoading(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          TrafficLens
        </h1>
        <p className="text-lg text-gray-700 mb-6">
          Analyze website traffic data for multiple domains. Get insights on monthly visits, growth trends, engagement metrics, and more.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-4">
          <label htmlFor="domains" className="block text-sm font-medium text-gray-700 mb-2">
            Paste domains (one per line or comma-separated)
          </label>
          <textarea
            id="domains"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="example.com&#10;google.com&#10;github.com"
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={handleNormalize}
            disabled={!input.trim()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Normalize
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Running...' : 'Run'}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
          >
            Clear
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-md cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="cursor-pointer"
            />
            <span className="text-sm">Dry Run (Mock Data)</span>
          </label>
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-md cursor-pointer">
            <input
              type="checkbox"
              checked={bypassCache}
              onChange={(e) => setBypassCache(e.target.checked)}
              className="cursor-pointer"
            />
            <span className="text-sm">Bypass Cache</span>
          </label>
        </div>

        {progress && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">{progress}</p>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Results ({results.length} domains)</h2>
            <ExportButtons results={results} />
          </div>
          <TrafficTable results={results} />
        </div>
      )}
    </main>
  );
}
