export type Protocol = 'PURE_ALOHA' | 'SLOTTED_ALOHA' | 'CSMA' | 'CSMA_CD';
export type TrafficModel = 'poisson' | 'uniform';
export type StationStatus = 'IDLE' | 'SENSING' | 'TRANSMITTING' | 'COLLISION' | 'BACKOFF' | 'WAITING' | 'SUCCESSFUL';
export type SimulationRunStatus = 'Ready' | 'Running' | 'Paused' | 'Completed' | 'Error';
export interface SimulationConfig {
  protocol: Protocol;
  stationCount: number;
  frameSizeBytes: number;
  dataRateBps: number;
  durationMs: number;
  trafficModel: TrafficModel;
  trafficIntensity?: number;
  randomSeed?: number;
  slotDurationMs?: number;
  propagationDelayMs?: number;
  maxRetries?: number;
  maxBackoffSlots?: number;
}
export interface StationSnapshot {
  stationId: string;
  status: StationStatus;
  queueLength?: number;
  currentFrameId?: string;
  retryCount?: number;
  backoffRemaining?: number;
}
export interface SimulationMetrics {
  successfulFrames: number;
  collisions: number;
  retransmissions: number;
  throughputBps?: number;
  goodputBps?: number;
  channelUtilization?: number;
  averageDelayMs?: number;
  elapsedMs: number;
}
export interface SimulationEvent { eventId: string; simulationTimeMs: number; eventType: string; stationIds: string[]; frameId?: string; message: string; }