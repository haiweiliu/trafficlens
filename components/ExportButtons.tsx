'use client';

import { TrafficData } from '@/types';

interface ExportButtonsProps {
  results: TrafficData[];
}

export default function ExportButtons({ results }: ExportButtonsProps) {
  const convertToTSV = (data: TrafficData[]): string => {
    const header = 'Domain\tMonthlyVisits\tAvgSessionDuration\tBounceRate\tPagesPerVisit\tCheckedAt';
    const rows = data.map((r) => {
      const visits = r.monthlyVisits !== null ? r.monthlyVisits.toString() : '';
      const duration = r.avgSessionDuration || '';
      const bounceRate = r.bounceRate !== null ? r.bounceRate.toString() : '';
      const pagesPerVisit = r.pagesPerVisit !== null ? r.pagesPerVisit.toString() : '';
      const checkedAt = r.checkedAt || '';
      return `${r.domain}\t${visits}\t${duration}\t${bounceRate}\t${pagesPerVisit}\t${checkedAt}`;
    });
    return [header, ...rows].join('\n');
  };

  const convertToCSV = (data: TrafficData[]): string => {
    const header = 'Domain,MonthlyVisits,AvgSessionDuration,BounceRate,PagesPerVisit,CheckedAt';
    const rows = data.map((r) => {
      const visits = r.monthlyVisits !== null ? r.monthlyVisits.toString() : '';
      const duration = r.avgSessionDuration || '';
      const bounceRate = r.bounceRate !== null ? r.bounceRate.toString() : '';
      const pagesPerVisit = r.pagesPerVisit !== null ? r.pagesPerVisit.toString() : '';
      const checkedAt = r.checkedAt || '';
      // Escape commas and quotes in CSV
      const escapeCSV = (str: string) => {
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      return [
        escapeCSV(r.domain),
        escapeCSV(visits),
        escapeCSV(duration),
        escapeCSV(bounceRate),
        escapeCSV(pagesPerVisit),
        escapeCSV(checkedAt),
      ].join(',');
    });
    return [header, ...rows].join('\n');
  };

  const handleCopyTSV = async () => {
    try {
      const tsv = convertToTSV(results);
      await navigator.clipboard.writeText(tsv);
      alert('TSV copied to clipboard! Ready to paste into Google Sheets.');
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard. Please try downloading CSV instead.');
    }
  };

  const handleDownloadCSV = () => {
    const csv = convertToCSV(results);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `traffic-data-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleCopyTSV}
        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
      >
        Copy TSV
      </button>
      <button
        onClick={handleDownloadCSV}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
      >
        Download CSV
      </button>
    </div>
  );
}

