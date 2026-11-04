import type { SimulationConfig, SimulationEvent, SimulationMetrics, StationSnapshot } from '../types';

export interface RunRecord {
  id: string;
  config: SimulationConfig;
  metrics: SimulationMetrics;
  createdAt: string;
  events: SimulationEvent[];
  stations: StationSnapshot[];
}

const KEY = 'macsim_runs';

function isRunRecord(value: unknown): value is RunRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<RunRecord>;
  return (
    typeof record.id === 'string' &&
    typeof record.createdAt === 'string' &&
    typeof record.config === 'object' &&
    record.config !== null &&
    typeof record.metrics === 'object' &&
    record.metrics !== null &&
    Array.isArray(record.events) &&
    Array.isArray(record.stations)
  );
}

export function getRuns(): RunRecord[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(isRunRecord)) {
    throw new Error('Saved simulation history is invalid. Clear the damaged history in Settings to continue.');
  }
  return parsed;
}

export function getRun(id: string): RunRecord | undefined {
  return getRuns().find(run => run.id === id);
}

export function saveRun(run: RunRecord): void {
  const runs = getRuns().filter(existing => existing.id !== run.id);
  runs.unshift(run);
  localStorage.setItem(KEY, JSON.stringify(runs));
}

export function clearRuns(): void {
  localStorage.removeItem(KEY);
}
