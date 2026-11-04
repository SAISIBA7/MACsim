import { apiRequest } from './client';
import type {
  SimulationConfig,
  SimulationListItem,
  SimulationSnapshot,
} from './types';

export async function createSimulation(
  config: Partial<SimulationConfig>,
): Promise<SimulationSnapshot> {
  return apiRequest<SimulationSnapshot>('/simulations', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function getSimulations(params?: {
  limit?: number;
  skip?: number;
  protocol?: string;
}): Promise<SimulationListItem[]> {
  const query = new URLSearchParams();
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  if (params?.skip !== undefined) query.set('skip', String(params.skip));
  if (params?.protocol !== undefined) query.set('protocol', params.protocol);

  const qs = query.toString();
  return apiRequest<SimulationListItem[]>(`/simulations${qs ? `?${qs}` : ''}`);
}

export async function getSimulation(id: string): Promise<SimulationSnapshot> {
  return apiRequest<SimulationSnapshot>(`/simulations/${encodeURIComponent(id)}`);
}

export async function getSimulationResults(id: string): Promise<unknown> {
  return apiRequest<unknown>(`/simulations/${encodeURIComponent(id)}/results`);
}

export async function deleteSimulation(id: string): Promise<void> {
  await apiRequest<void>(`/simulations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function startSimulation(
  id: string,
  runToCompletion = false,
): Promise<SimulationSnapshot> {
  return apiRequest<SimulationSnapshot>(
    `/simulations/${encodeURIComponent(id)}/start`,
    {
      method: 'POST',
      body: JSON.stringify({ runToCompletion }),
    },
  );
}

export async function pauseSimulation(id: string): Promise<SimulationSnapshot> {
  return apiRequest<SimulationSnapshot>(
    `/simulations/${encodeURIComponent(id)}/pause`,
    {
      method: 'POST',
    },
  );
}

export async function resumeSimulation(
  id: string,
): Promise<SimulationSnapshot> {
  return apiRequest<SimulationSnapshot>(
    `/simulations/${encodeURIComponent(id)}/resume`,
    {
      method: 'POST',
    },
  );
}

export async function stepSimulation(
  id: string,
  stepCount = 1,
  deltaUs?: number,
): Promise<SimulationSnapshot> {
  return apiRequest<SimulationSnapshot>(
    `/simulations/${encodeURIComponent(id)}/step`,
    {
      method: 'POST',
      body: JSON.stringify({
        step_count: stepCount,
        delta_time_us: deltaUs,
      }),
    },
  );
}

export async function resetSimulation(id: string): Promise<SimulationSnapshot> {
  return apiRequest<SimulationSnapshot>(
    `/simulations/${encodeURIComponent(id)}/reset`,
    {
      method: 'POST',
    },
  );
}

