/** Analytics category canonical operations (UI contract `analytics/v1`). */
export const analyticsV1Operations = ['track', 'identify'] as const;
export type AnalyticsV1Operation = (typeof analyticsV1Operations)[number];
