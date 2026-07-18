export type OperationsMetric = {
  key: string;
  label: string;
  completed: number;
  total: number;
  unit: "名" | "件";
  href: string;
};

export function completionPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
}

export function operationsMetricState(metric: OperationsMetric): "empty" | "attention" | "complete" {
  if (metric.total === 0 || metric.completed === 0) return "empty";
  return metric.completed >= metric.total ? "complete" : "attention";
}

