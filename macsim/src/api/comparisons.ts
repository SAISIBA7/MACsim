import { apiRequest } from './client';
import type { ComparisonResult, SweepRequest } from './types';

export async function runSweep(params: SweepRequest): Promise<ComparisonResult> {
  return apiRequest<ComparisonResult>('/comparisons/sweep', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function createComparison(
  simulationIds: string[],
  notes?: string,
): Promise<any> {
  return apiRequest<any>('/comparisons', {
    method: 'POST',
    body: JSON.stringify({ simulationIds, notes }),
  });
}

export async function getComparisons(): Promise<any[]> {
  return apiRequest<any[]>('/comparisons');
}

export async function getComparison(id: string): Promise<any> {
  return apiRequest<any>(`/comparisons/${encodeURIComponent(id)}`);
}

