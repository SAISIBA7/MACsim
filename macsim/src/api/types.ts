export type Protocol = 'PURE_ALOHA' | 'SLOTTED_ALOHA' | 'CSMA' | 'CSMA_CD';

export type TrafficModel = 'poisson' | 'uniform' | 'burst' | 'constant';

export type StationStatus =
  | 'IDLE'
  | 'SENSING'
  | 'TRANSMITTING'
  | 'COLLISION'
  | 'BACKOFF'
  | 'WAITING'
  | 'SUCCESSFUL';

export type SimulationRunStatus = 'Ready' | 'Running' | 'Paused' | 'Completed' | 'Error';

export interface SimulationConfig {
  protocol: Protocol;
  stationCount: number;
  frameSizeBytes: number;
  dataRateBps: number;
  durationMs: number;
  trafficModel: TrafficModel;
  trafficIntensity: number;
  randomSeed?: number;
  slotDurationMs?: number;
  propagationDelayMs?: number;
  maxRetries?: number;
  maxBackoffSlots?: number;
  name?: string;
  // Backend snake_case aliases
  num_stations?: number;
  frame_size_bytes?: number;
  channel_bandwidth_bps?: number;
  simulation_time_us?: number;
  traffic_distribution?: string;
  arrival_rate_lambda?: number;
  random_seed?: number;
  slot_time_us?: number;
  propagation_delay_us?: number;
  max_retry_limit?: number;
}

export interface StationSnapshot {
  stationId: string;
  stationNumber?: number;
  status: StationStatus;
  queueLength?: number;
  currentFrameId?: string;
  retryCount?: number;
  backoffRemaining?: number;
  successfulTransmissions?: number;
  collisions?: number;
  retransmissions?: number;
  droppedFrames?: number;
}

export interface MediumSnapshot {
  status: 'IDLE' | 'BUSY' | 'COLLISION';
  activeFrameIds: string[];
  activeStations: string[];
  inCollision: boolean;
}

export interface SimulationMetrics {
  generatedFrames?: number;
  successfulFrames: number;
  collisions: number;
  collidedAttempts?: number;
  retransmissions: number;
  droppedFrames?: number;
  throughputBps?: number;
  goodputBps?: number;
  channelUtilization?: number;
  averageDelayMs?: number;
  elapsedMs: number;
  isFinal?: boolean;
  collisionIncidents?: number;
  packetDeliveryRatio?: number;
  dropRate?: number;
  totalSlots?: number;
  idleSlots?: number;
  successfulSlots?: number;
  collidedSlots?: number;
  slotUtilization?: number;
  theoreticalEfficiency?: number;
}

export interface SimulationEvent {
  eventId: string;
  simulationId?: string;
  sequenceNumber?: number;
  simulationTimeMs: number;
  eventType: string;
  stationIds: string[];
  frameId?: string;
  message: string;
  payload?: Record<string, unknown>;
  timestamp?: number;
  id?: string;
  sequence_number?: number;
}

export interface SimulationSnapshot {
  id: string;
  protocol: Protocol;
  status: SimulationRunStatus;
  configuration: SimulationConfig;
  currentSimulationTimeMs: number;
  createdAt: string;
  stations: StationSnapshot[];
  medium: MediumSnapshot;
  metrics: SimulationMetrics;
  engineVersion?: string;
  randomSeed?: number;
}

export interface SimulationListItem {
  id: string;
  protocol: Protocol;
  status: SimulationRunStatus;
  configuration: SimulationConfig;
  createdAt: string;
  metrics: SimulationMetrics;
}

export interface HealthResponse {
  status: string;
  engineVersion: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}

export interface ProtocolMetadata {
  id: Protocol;
  name: string;
  description: string;
  theoreticalFormula: string;
  maxEfficiency: number;
  optimalOfferedLoad: number;
  supportedParameters: string[];
  defaults: Record<string, unknown>;
}

export interface ProtocolsResponse {
  protocols: ProtocolMetadata[];
  trafficModels: Array<{ id: string; name: string }>;
  globalDefaults: Record<string, unknown>;
  limits: Record<string, unknown>;
}

export interface SweepRequest {
  protocols: Protocol[];
  startLambda?: number;
  endLambda?: number;
  steps?: number;
  numStations?: number;
  simulationTimeUs?: number;
  frameSizeBytes?: number;
  bandwidthBps?: number;
  name?: string;
  load_range?: {
    start_lambda: number;
    end_lambda: number;
    steps: number;
  };
}

export interface ComparisonRun {
  simulation_id: string;
  protocol: Protocol;
  offered_load: number;
  throughput_bps: number;
  channel_efficiency: number;
  collision_rate: number;
  average_latency_us: number;
}

export interface ComparisonResult {
  id: string;
  name?: string;
  created_at?: string;
  runs: ComparisonRun[];
}

export interface ApiError {
  statusCode: number;
  error?: string;
  message: string;
  details?: unknown;
}
