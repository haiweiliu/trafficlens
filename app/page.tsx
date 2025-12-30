'use client';

import { useState } from 'react';
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
    setProgress('Starting...');
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

      // Send all domains at once - backend handles parallel batching
      const batches = Math.ceil(domainsToCheck.length / 10);
      setProgress(`Processing ${domainsToCheck.length} domains in ${batches} batches (${Math.min(3, batches)} parallel)...`);

      const response = await fetch('/api/traffic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domains: domainsToCheck, // Send all domains at once
          dryRun,
          bypassCache,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch traffic data');
      }

      const data: TrafficResponse = await response.json();
      setResults(data.results);
      setProgress(`Completed! Processed ${data.results.length} domains (${data.metadata.batchesProcessed} batches)`);
    } catch (error) {
      console.error('Error:', error);
      alert(error instanceof Error ? error.message : 'An error occurred');
      setProgress('Error occurred');
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(''), 3000);
    }
  };

  const handleClear = () => {
    setInput('');
    setResults([]);
    setProgress('');
  };

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Traffic Bulk Extractor</h1>
        <p className="text-gray-600 mb-4">
          Estimate website traffic by scraping Traffic.cv's Bulk Traffic Checker
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This tool fetches publicly visible estimates from traffic.cv. 
            Please respect their Terms/limits.
          </p>
        </div>
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
