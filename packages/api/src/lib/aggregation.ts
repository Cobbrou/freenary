export const AGGREGATION_MODES = ["total", "average", "median"] as const;

export type AggregationMode = (typeof AGGREGATION_MODES)[number];
