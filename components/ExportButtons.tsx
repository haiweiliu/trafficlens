"use client";

import { TrafficData } from "@/lib/types";

interface ExportButtonsProps {
  data: TrafficData[];
}

export default function ExportButtons({ data }: ExportButtonsProps) {
  const exportCSV = () => {
    const headers = [
      "Domain",
      "Monthly Visits",
      "Growth (%)",
      "Avg Duration (s)",
      "Pages/Visit",
      "Bounce Rate (%)",
      "Status",
    ];

    const rows = data.map((row) => [
      row.domain,
      row.monthlyVisits ?? "N/A",
      row.growth ?? "N/A",
      row.avgDuration ?? "N/A",
      row.pagesPerVisit ?? "N/A",
      row.bounceRate ?? "N/A",
      row.status,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `trafficlens-export-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportJSON = () => {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], {
      type: "application/json;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `trafficlens-export-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={exportCSV}
        className="tl-btn-secondary w-full sm:w-auto"
      >
        Export CSV
      </button>
      <button
        type="button"
        onClick={exportJSON}
        className="tl-btn-secondary w-full sm:w-auto"
      >
        Export JSON
      </button>
    </div>
  );
}
