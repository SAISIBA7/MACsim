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
const DEFAULTS_KEY = 'macsim_defaults';

export interface SimulationDefaults {
  stationCount: number;
  frameSizeBytes: number;
  dataRateBps: number;
  durationMs: number;
  trafficModel: 'poisson' | 'uniform';
  trafficIntensity: number;
}

export const defaultSimulationSettings: SimulationDefaults = {
  stationCount: 4,
  frameSizeBytes: 1024,
  dataRateBps: 1000000,
  durationMs: 1000,
  trafficModel: 'poisson',
  trafficIntensity: 0.5,
};

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

export function deleteRun(id: string): void {
  const runs = getRuns().filter(existing => existing.id !== id);
  localStorage.setItem(KEY, JSON.stringify(runs));
}

export function clearRuns(): void {
  localStorage.removeItem(KEY);
}

export function getSimulationDefaults(): SimulationDefaults {
  const raw = localStorage.getItem(DEFAULTS_KEY);
  if (!raw) return defaultSimulationSettings;
  try {
    const parsed = JSON.parse(raw);
    return {
      stationCount: typeof parsed.stationCount === 'number' ? parsed.stationCount : defaultSimulationSettings.stationCount,
      frameSizeBytes: typeof parsed.frameSizeBytes === 'number' ? parsed.frameSizeBytes : defaultSimulationSettings.frameSizeBytes,
      dataRateBps: typeof parsed.dataRateBps === 'number' ? parsed.dataRateBps : defaultSimulationSettings.dataRateBps,
      durationMs: typeof parsed.durationMs === 'number' ? parsed.durationMs : defaultSimulationSettings.durationMs,
      trafficModel: parsed.trafficModel === 'uniform' ? 'uniform' : 'poisson',
      trafficIntensity: typeof parsed.trafficIntensity === 'number' ? parsed.trafficIntensity : defaultSimulationSettings.trafficIntensity,
    };
  } catch {
    return defaultSimulationSettings;
  }
}

export function saveSimulationDefaults(defaults: SimulationDefaults): void {
  localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults));
}

export function exportRunsJson(): string {
  const runs = getRuns();
  return JSON.stringify(runs, null, 2);
}

export function importRunsJson(jsonString: string): { importedCount: number } {
  const parsed: unknown = JSON.parse(jsonString);
  if (!Array.isArray(parsed) || !parsed.every(isRunRecord)) {
    throw new Error('Imported JSON file does not contain valid MACSim simulation records.');
  }
  const existing = getRuns();
  const existingIds = new Set(existing.map(r => r.id));
  const newRuns = parsed.filter(r => !existingIds.has(r.id));
  const merged = [...newRuns, ...existing];
  localStorage.setItem(KEY, JSON.stringify(merged));
  return { importedCount: newRuns.length };
}
