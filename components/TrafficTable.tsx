"use client";

import { useState, useMemo } from "react";
import { TrafficData } from "@/lib/types";

interface TrafficTableProps {
  data: TrafficData[];
}

type SortField = keyof TrafficData;
type SortDirection = "asc" | "desc";

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active) {
    return (
      <span className="ml-1 inline-block text-zinc-300" aria-hidden="true">
        ↕
      </span>
    );
  }
  return (
    <span className="ml-1 inline-block text-sky-600" aria-hidden="true">
      {direction === "asc" ? "↑" : "↓"}
    </span>
  );
}

function StatusBadge({ status }: { status: TrafficData["status"] }) {
  const styles: Record<string, string> = {
    success: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
    error: "bg-red-50 text-red-800 ring-red-600/20",
    pending: "bg-amber-50 text-amber-800 ring-amber-600/20",
  };

  const labels: Record<string, string> = {
    success: "OK",
    error: "Error",
    pending: "Pending",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status] || "bg-zinc-50 text-zinc-600 ring-zinc-500/20"}`}
    >
      {labels[status] || status}
    </span>
  );
}

export default function TrafficTable({ data }: TrafficTableProps) {
  const [sortField, setSortField] = useState<SortField>("domain");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filters, setFilters] = useState({
    domain: "",
    status: "",
    minVisits: "",
    maxVisits: "",
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    let filtered = [...data];

    if (filters.domain) {
      filtered = filtered.filter((item) =>
        item.domain.toLowerCase().includes(filters.domain.toLowerCase())
      );
    }

    if (filters.status) {
      filtered = filtered.filter((item) => item.status === filters.status);
    }

    if (filters.minVisits) {
      const min = parseInt(filters.minVisits, 10);
      filtered = filtered.filter(
        (item) => item.monthlyVisits !== null && item.monthlyVisits >= min
      );
    }

    if (filters.maxVisits) {
      const max = parseInt(filters.maxVisits, 10);
      filtered = filtered.filter(
        (item) => item.monthlyVisits !== null && item.monthlyVisits <= max
      );
    }

    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    return filtered;
  }, [data, sortField, sortDirection, filters]);

  const formatNumber = (num: number | null) => {
    if (num === null) return "N/A";
    return num.toLocaleString();
  };

  const formatGrowth = (growth: number | null) => {
    if (growth === null) return "N/A";
    const sign = growth >= 0 ? "+" : "";
    return `${sign}${growth.toFixed(1)}%`;
  };

  const thClass =
    "cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:bg-zinc-50";

  return (
    <div className="space-y-4">
      <div className="tl-surface p-4 sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Filters
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="filter-domain" className="tl-label">
              Domain
            </label>
            <input
              id="filter-domain"
              type="text"
              placeholder="Search…"
              value={filters.domain}
              onChange={(e) =>
                setFilters({ ...filters, domain: e.target.value })
              }
              className="tl-input"
            />
          </div>
          <div>
            <label htmlFor="filter-status" className="tl-label">
              Status
            </label>
            <select
              id="filter-status"
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              className="tl-input"
            >
              <option value="">All</option>
              <option value="success">OK</option>
              <option value="error">Error</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div>
            <label htmlFor="filter-min" className="tl-label">
              Min visits
            </label>
            <input
              id="filter-min"
              type="number"
              placeholder="0"
              value={filters.minVisits}
              onChange={(e) =>
                setFilters({ ...filters, minVisits: e.target.value })
              }
              className="tl-input tabular-nums"
            />
          </div>
          <div>
            <label htmlFor="filter-max" className="tl-label">
              Max visits
            </label>
            <input
              id="filter-max"
              type="number"
              placeholder="∞"
              value={filters.maxVisits}
              onChange={(e) =>
                setFilters({ ...filters, maxVisits: e.target.value })
              }
              className="tl-input tabular-nums"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            setFilters({
              domain: "",
              status: "",
              minVisits: "",
              maxVisits: "",
            })
          }
          className="tl-btn-ghost mt-4"
        >
          Reset filters
        </button>
      </div>

      <div className="tl-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50/80">
              <tr>
                <th
                  className={thClass}
                  onClick={() => handleSort("domain")}
                >
                  Domain
                  <SortIndicator
                    active={sortField === "domain"}
                    direction={sortDirection}
                  />
                </th>
                <th
                  className={thClass}
                  onClick={() => handleSort("monthlyVisits")}
                >
                  Monthly visits
                  <SortIndicator
                    active={sortField === "monthlyVisits"}
                    direction={sortDirection}
                  />
                </th>
                <th
                  className={thClass}
                  onClick={() => handleSort("growth")}
                >
                  Growth
                  <SortIndicator
                    active={sortField === "growth"}
                    direction={sortDirection}
                  />
                </th>
                <th
                  className={thClass}
                  onClick={() => handleSort("avgDuration")}
                >
                  Avg duration
                  <SortIndicator
                    active={sortField === "avgDuration"}
                    direction={sortDirection}
                  />
                </th>
                <th
                  className={thClass}
                  onClick={() => handleSort("pagesPerVisit")}
                >
                  Pages / visit
                  <SortIndicator
                    active={sortField === "pagesPerVisit"}
                    direction={sortDirection}
                  />
                </th>
                <th
                  className={thClass}
                  onClick={() => handleSort("bounceRate")}
                >
                  Bounce rate
                  <SortIndicator
                    active={sortField === "bounceRate"}
                    direction={sortDirection}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {filteredAndSorted.map((row, idx) => (
                <tr key={`${row.domain}-${idx}`} className="hover:bg-zinc-50/60">
                  <td className="whitespace-nowrap px-4 py-3.5 text-sm font-medium text-zinc-900">
                    {row.domain}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-sm tabular-nums text-zinc-700">
                    {formatNumber(row.monthlyVisits)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3.5 text-sm tabular-nums ${
                      row.growth !== null && row.growth >= 0
                        ? "text-emerald-700"
                        : row.growth !== null
                          ? "text-red-700"
                          : "text-zinc-500"
                    }`}
                  >
                    {formatGrowth(row.growth)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-sm tabular-nums text-zinc-700">
                    {row.avgDuration !== null
                      ? `${row.avgDuration.toFixed(1)}s`
                      : "N/A"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-sm tabular-nums text-zinc-700">
                    {row.pagesPerVisit !== null
                      ? row.pagesPerVisit.toFixed(2)
                      : "N/A"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-sm tabular-nums text-zinc-700">
                    {row.bounceRate !== null
                      ? `${row.bounceRate.toFixed(1)}%`
                      : "N/A"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-sm">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredAndSorted.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">
            No results match your filters.
          </p>
        )}
      </div>
    </div>
  );
}
