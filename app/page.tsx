"use client";

import { useState } from "react";
import TrafficTable from "@/components/TrafficTable";
import ExportButtons from "@/components/ExportButtons";
import { TrafficData } from "@/lib/types";
import { normalizeTrafficResults } from "@/lib/normalize-traffic";
import type { TrafficData as ApiTrafficData } from "@/types";

export default function Home() {
  const [domains, setDomains] = useState("");
  const [results, setResults] = useState<TrafficData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [bypassCache, setBypassCache] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProgress(null);

    const domainList = domains
      .split(/[\n,]/)
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    if (domainList.length === 0) {
      setError("Please enter at least one domain");
      setLoading(false);
      return;
    }

    try {
      setProgress(`Analyzing ${domainList.length} domain(s)…`);

      const response = await fetch("/api/traffic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domains: domainList,
          dryRun,
          bypassCache,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch traffic data");
      }

      const data = await response.json();

      const apiResults = (data.results || []) as ApiTrafficData[];

      if (data.metadata?.backgroundScraping ?? data.backgroundScraping) {
        setProgress(
          "Scraping in background — results will appear as they complete."
        );
        setResults(normalizeTrafficResults(apiResults));
        setLoading(false);
        pollForResults(domainList);
      } else {
        setProgress(null);
        setResults(normalizeTrafficResults(apiResults));
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setProgress(null);
      setLoading(false);
    }
  };

  const pollForResults = async (domainList: string[]) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setProgress("Background scrape timed out — try bypass cache or retry.");
        return;
      }

      attempts++;

      try {
        const response = await fetch("/api/traffic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domains: domainList, dryRun, bypassCache }),
        });

        if (response.ok) {
          const data = await response.json();
          const apiResults = (data.results || []) as ApiTrafficData[];
          const normalized = normalizeTrafficResults(apiResults);
          setResults(normalized);

          const allComplete = normalized.every((r) => r.status !== "pending");

          if (allComplete) {
            setProgress("All domains processed.");
            setLoading(false);
          } else {
            setProgress(
              `Processing… (${attempts}/${maxAttempts})`
            );
            setTimeout(poll, 2000);
          }
        }
      } catch {
        setTimeout(poll, 2000);
      }
    };

    setTimeout(poll, 2000);
  };

  const handleClear = () => {
    setDomains("");
    setResults([]);
    setError(null);
    setProgress(null);
  };

  const handleNormalize = () => {
    const normalized = domains
      .split(/[\n,]/)
      .map((d) => {
        let domain = d.trim().toLowerCase();
        domain = domain.replace(/^https?:\/\//, "");
        domain = domain.replace(/^www\./, "");
        domain = domain.split("/")[0];
        return domain;
      })
      .filter((d) => d.length > 0)
      .join("\n");

    setDomains(normalized);
  };

  return (
    <main className="min-h-[100dvh] bg-zinc-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.04)_1px,transparent_0)] [background-size:24px_24px]" />

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
            Bulk traffic intelligence
          </p>
          <h1 className="text-4xl font-semibold tracking-tighter text-zinc-900 sm:text-5xl">
            TrafficLens
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-600">
            Paste domains, run a bulk lookup, and export monthly visits,
            growth, and engagement metrics from traffic.cv.
          </p>
        </header>

        <div className="tl-surface p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="domains" className="tl-label">
                Domains
              </label>
              <textarea
                id="domains"
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                placeholder="example.com&#10;another-site.com&#10;third-domain.org"
                className="tl-input min-h-[160px] resize-y font-mono"
                rows={8}
              />
              <p className="mt-2 text-xs text-zinc-500">
                One domain per line, or comma-separated
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={handleNormalize}
                className="tl-btn-secondary w-full sm:w-auto"
              >
                Normalize
              </button>
              <button
                type="submit"
                disabled={loading}
                className="tl-btn-primary w-full sm:w-auto sm:min-w-[140px]"
              >
                {loading ? "Running…" : "Run analysis"}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="tl-btn-danger w-full sm:w-auto"
              >
                Clear
              </button>
            </div>

            <div className="flex flex-col gap-4 border-t border-zinc-100 pt-5 sm:flex-row sm:gap-8">
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="h-5 w-5 rounded border-zinc-300 text-sky-600 focus:ring-sky-500/20"
                />
                <span className="text-sm text-zinc-700">
                  Dry run{" "}
                  <span className="text-zinc-500">(skip database write)</span>
                </span>
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={bypassCache}
                  onChange={(e) => setBypassCache(e.target.checked)}
                  className="h-5 w-5 rounded border-zinc-300 text-sky-600 focus:ring-sky-500/20"
                />
                <span className="text-sm text-zinc-700">
                  Bypass cache{" "}
                  <span className="text-zinc-500">(force fresh scrape)</span>
                </span>
              </label>
            </div>
          </form>

          {error && (
            <div
              className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </div>
          )}

          {progress && (
            <div className="mt-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              {progress}
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
                Results
                <span className="ml-2 text-base font-normal text-zinc-500">
                  ({results.length})
                </span>
              </h2>
              <ExportButtons data={results} />
            </div>
            <TrafficTable data={results} />
          </div>
        )}
      </div>
    </main>
  );
}
