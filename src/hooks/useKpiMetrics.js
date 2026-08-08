import { useMemo } from 'react';
import { computeKpis } from '../lib/mockData';

export function useKpiMetrics(transactions) {
  return useMemo(() => computeKpis(transactions), [transactions]);
}
