import { apiRequest, getApiBaseUrl } from './client';
import type { SimulationEvent, SimulationSnapshot } from './types';

export async function getSimulationEvents(
  id: string,
  params?: { afterSequence?: number; limit?: number },
): Promise<SimulationEvent[]> {
  const query = new URLSearchParams();
  if (params?.afterSequence !== undefined) {
    query.set('after_sequence', String(params.afterSequence));
  }
  if (params?.limit !== undefined) {
    query.set('limit', String(params.limit));
  }

  const qs = query.toString();
  return apiRequest<SimulationEvent[]>(
    `/simulations/${encodeURIComponent(id)}/events${qs ? `?${qs}` : ''}`,
  );
}

export const KNOWN_EVENT_TYPES = [
  'snapshot',
  'message',
  'FRAME_GENERATED',
  'STATION_STATE_CHANGED',
  'MEDIUM_STATE_CHANGED',
  'TRANSMISSION_STARTED',
  'TRANSMISSION_COMPLETED',
  'COLLISION_DETECTED',
  'BACKOFF_STARTED',
  'BACKOFF_COMPLETED',
  'RETRANSMISSION_ATTEMPTED',
  'FRAME_DELIVERED',
  'FRAME_DROPPED',
  'METRICS_UPDATED',
  'SIMULATION_STARTED',
  'SIMULATION_PAUSED',
  'SIMULATION_RESUMED',
  'SIMULATION_COMPLETED',
  'SIMULATION_FAILED',
  'SIMULATION_RESET',
  'CARRIER_SENSED_BUSY',
  'CARRIER_SENSED_IDLE',
  'SLOT_BOUNDARY',
] as const;

export interface EventStreamHandlers {
  onSnapshot?: (snapshot: SimulationSnapshot) => void;
  onEvent?: (event: SimulationEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
}

export function subscribeToSimulationStream(
  simulationId: string,
  handlers: EventStreamHandlers,
  options?: { afterSequence?: number },
): () => void {
  const baseUrl = getApiBaseUrl();
  const query = new URLSearchParams();
  if (options?.afterSequence && options.afterSequence > 0) {
    query.set('after_sequence', String(options.afterSequence));
  }
  const qs = query.toString();
  const streamUrl = `${baseUrl}/simulations/${encodeURIComponent(simulationId)}/stream${qs ? `?${qs}` : ''}`;

  const eventSource = new EventSource(streamUrl);

  eventSource.onopen = () => {
    handlers.onOpen?.();
  };

  eventSource.onerror = (err) => {
    handlers.onError?.(err);
  };

  eventSource.addEventListener('snapshot', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      handlers.onSnapshot?.(data);
    } catch {
      // Ignore unparseable snapshot
    }
  });

  const handleGenericEvent = (e: MessageEvent) => {
    try {
      const parsed = JSON.parse(e.data);
      const seq = Number(e.lastEventId || parsed.sequenceNumber || parsed.sequence_number || 0);
      const normalized: SimulationEvent = {
        eventId: parsed.eventId || parsed.id || `evt_${seq}`,
        sequenceNumber: seq,
        simulationTimeMs: parsed.simulationTimeMs ?? (parsed.timestamp ? parsed.timestamp / 1000 : 0),
        eventType: e.type || parsed.eventType || parsed.event_type || 'EVENT',
        stationIds: parsed.stationIds ?? (parsed.station_id ? [parsed.station_id] : []),
        frameId: parsed.frameId ?? parsed.frame_id ?? null,
        message: parsed.message || `${e.type} event`,
        payload: parsed.payload || parsed.details,
      };
      handlers.onEvent?.(normalized);
    } catch {
      // Ignore unparseable event
    }
  };

  for (const eventType of KNOWN_EVENT_TYPES) {
    if (eventType !== 'snapshot') {
      eventSource.addEventListener(eventType, handleGenericEvent);
    }
  }

  // Also catch default un-typed messages
  eventSource.onmessage = handleGenericEvent;

  return () => {
    eventSource.close();
  };
}

