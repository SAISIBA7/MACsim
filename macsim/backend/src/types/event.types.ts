import { EventType } from '../config/constants.js';

export interface SimulationEventModel {
  eventId: string;
  simulationId: string;
  sequenceNumber: number;
  simulationTimeMs: number;
  eventType: EventType | string;
  stationIds: string[];
  frameId?: string | null;
  attemptId?: string | null;
  message: string;
  payload?: Record<string, unknown>;

  // Backwards compatibility aliases
  id?: string;
  simulation_id?: string;
  sequence_number?: number;
  timestamp?: number;
  event_type?: string;
  station_id?: string | null;
  frame_id?: string | null;
  details?: Record<string, unknown>;
}

export interface ScheduledEvent {
  id: string;
  time: number; // in microseconds
  priority: number;
  type: string;
  handler: () => void;
  sequenceNumber: number;
  stationId?: string;
  frameId?: string;
  data?: Record<string, unknown>;
}
