'use client';

import { useState, useMemo } from 'react';
import { TrafficData } from '@/types';

interface TrafficTableProps {
  results: TrafficData[];
}

type SortField = 'domain' | 'monthlyVisits' | 'avgSessionDuration' | 'growthRate' | 'checkedAt';
type SortDirection = 'asc' | 'desc';

export default function TrafficTable({ results }: TrafficTableProps) {
  const [sortField, setSortField] = useState<SortField>('monthlyVisits');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedResults = useMemo(() => {
    const sorted = [...results].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle null values
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Handle numbers
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Handle strings
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return 0;
    });

    return sorted;
  }, [results, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatNumber = (num: number | null): string => {
    if (num === null) return 'N/A';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-400">↕</span>;
    }
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              onClick={() => handleSort('domain')}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              <div className="flex items-center gap-1">
                Domain
                <SortIcon field="domain" />
              </div>
            </th>
            <th
              onClick={() => handleSort('monthlyVisits')}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              <div className="flex items-center gap-1">
                Monthly Visits
                <SortIcon field="monthlyVisits" />
              </div>
            </th>
            <th
              onClick={() => handleSort('growthRate')}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              <div className="flex items-center gap-1">
                Growth/Decline
                <SortIcon field="growthRate" />
              </div>
            </th>
            <th
              onClick={() => handleSort('avgSessionDuration')}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              <div className="flex items-center gap-1">
                Avg Session Duration
                <SortIcon field="avgSessionDuration" />
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Bounce Rate
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pages/Visit
            </th>
            <th
              onClick={() => handleSort('checkedAt')}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            >
              <div className="flex items-center gap-1">
                Checked At
                <SortIcon field="checkedAt" />
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedResults.map((result, index) => (
            <tr key={`${result.domain}-${index}`} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {result.domain}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {result.monthlyVisits !== null
                  ? formatNumber(result.monthlyVisits)
                  : 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {result.growthRate !== null ? (
                  <span className={result.growthRate >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {result.growthRate >= 0 ? '+' : ''}{result.growthRate.toFixed(2)}%
                  </span>
                ) : (
                  <span className="text-gray-400">N/A</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {result.avgSessionDuration || 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {result.bounceRate !== null ? `${result.bounceRate}%` : 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {result.pagesPerVisit !== null
                  ? result.pagesPerVisit.toFixed(1)
                  : 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {result.checkedAt
                  ? new Date(result.checkedAt).toLocaleString()
                  : 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {result.error ? (
                  <span className="text-red-600" title={result.error}>
                    ⚠ {result.error}
                  </span>
                ) : (
                  <span className="text-green-600">✓</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

