/**
 * UI-facing traffic row shape for tables and exports.
 */

export type TrafficStatus = "success" | "error" | "pending";

export interface TrafficData {
  domain: string;
  monthlyVisits: number | null;
  growth: number | null;
  avgDuration: number | null;
  pagesPerVisit: number | null;
  bounceRate: number | null;
  status: TrafficStatus;
  error?: string | null;
}
