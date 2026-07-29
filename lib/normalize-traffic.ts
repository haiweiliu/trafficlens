import type { TrafficData as ApiTrafficData } from "@/types";
import type { TrafficData, TrafficStatus } from "@/lib/types";

function deriveStatus(row: ApiTrafficData): TrafficStatus {
  if (row.error?.toLowerCase().includes("background")) {
    return "pending";
  }
  if (row.error) {
    return "error";
  }
  if (row.monthlyVisits === null && !row.avgSessionDurationSeconds) {
    return "pending";
  }
  return "success";
}

export function normalizeTrafficRow(row: ApiTrafficData): TrafficData {
  return {
    domain: row.domain,
    monthlyVisits: row.monthlyVisits ?? null,
    growth: null,
    avgDuration: row.avgSessionDurationSeconds ?? null,
    pagesPerVisit: row.pagesPerVisit ?? null,
    bounceRate: row.bounceRate ?? null,
    status: deriveStatus(row),
    error: row.error,
  };
}

export function normalizeTrafficResults(rows: ApiTrafficData[]): TrafficData[] {
  return rows.map(normalizeTrafficRow);
}
