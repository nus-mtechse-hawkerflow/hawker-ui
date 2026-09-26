/**
 * Analytics contract, served by hawkerflow-service-analytics.
 *
 * These figures are computed in PostgreSQL from persisted orders, not in the
 * browser. They are identical on every device and survive a refresh.
 *
 * Deliberately absent: payment breakdown, preparation time, takeaway fees and
 * shift closure. The order schema records none of them, and the API names them
 * in `unavailableMetrics` rather than returning invented values.
 */

export interface TopItem {
  dishId: number;
  name: string;
  quantity: number;
  completedItemValue: number;
}

export interface HourlyBucket {
  /** 0-23, Singapore time. All 24 are always present, including empty ones. */
  hour: number;
  orderCount: number;
  completedOrderValue: number;
}

export interface StallDaySummary {
  stallId: number;
  /** YYYY-MM-DD, Singapore calendar date. */
  date: string;
  timezone: string;
  source: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  /** This stall's share only, already rounded to two places. Do not re-round. */
  completedOrderValue: number;
  /** null when nothing completed. Never 0, which would read as a measurement. */
  averageCompletedOrderValue: number | null;
  topItems: TopItem[];
  /** Always exactly 24 entries. */
  hourlyOrders: HourlyBucket[];
  unavailableMetrics: string[];
}

export type AnalyticsStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unmapped';
