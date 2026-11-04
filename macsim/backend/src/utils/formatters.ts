import { SimulationEngine } from '../engine/SimulationEngine.js';
import { SimulationModel } from '../types/simulation.types.js';
import { env } from '../config/env.js';

export function normalizeConfig(raw: any): any {
  if (!raw) return {};

  const protocol = (raw.protocol || 'PURE_ALOHA').toUpperCase();
  const stationCount = raw.stationCount ?? raw.num_stations ?? 4;
  const frameSizeBytes = raw.frameSizeBytes ?? raw.frame_size_bytes ?? 1024;
  const dataRateBps = raw.dataRateBps ?? raw.channel_bandwidth_bps ?? 1_000_000;
  const durationMs = raw.durationMs ?? (raw.simulation_time_us ? raw.simulation_time_us / 1000 : 1000);
  const simulation_time_us = durationMs * 1000;
  const trafficModel = (raw.trafficModel || raw.traffic_distribution || 'poisson').toLowerCase();

  // Traffic intensity: frames per frame-time per station
  const trafficIntensity = raw.trafficIntensity ?? (raw.arrival_rate_lambda ? 0.5 : 0.5);
  const frameTimeSec = (frameSizeBytes * 8) / Math.max(1, dataRateBps);
  // lambda = intensity / frameTimeSec (frames per second per station)
  const arrival_rate_lambda = raw.arrival_rate_lambda ?? (trafficIntensity / Math.max(1e-6, frameTimeSec));

  const randomSeed = raw.randomSeed ?? raw.random_seed ?? 42;
  const slotDurationMs = raw.slotDurationMs ?? (raw.slot_time_us ? raw.slot_time_us / 1000 : (frameTimeSec * 1000));
  const slot_time_us = slotDurationMs * 1000;
  const propagationDelayMs = raw.propagationDelayMs ?? (raw.propagation_delay_us ? raw.propagation_delay_us / 1000 : 0.005);
  const propagation_delay_us = propagationDelayMs * 1000;
  const maxRetries = raw.maxRetries ?? raw.max_retry_limit ?? 16;
  const maxBackoffSlots = raw.maxBackoffSlots ?? 16;

  return {
    protocol,
    num_stations: stationCount,
    stationCount,
    frame_size_bytes: frameSizeBytes,
    frameSizeBytes,
    channel_bandwidth_bps: dataRateBps,
    dataRateBps,
    simulation_time_us,
    durationMs,
    traffic_distribution: trafficModel.toUpperCase(),
    trafficModel,
    arrival_rate_lambda,
    trafficIntensity,
    random_seed: randomSeed,
    randomSeed,
    slot_time_us,
    slotDurationMs,
    propagation_delay_us,
    propagationDelayMs,
    max_retry_limit: maxRetries,
    maxRetries,
    maxBackoffSlots,
    name: raw.name || `${protocol}_Simulation`,
  };
}

export function formatSimulationDetail(engineOrModel: SimulationEngine | SimulationModel): any {
  const isEngine = 'getMetrics' in engineOrModel;

  const id = engineOrModel.id;
  const protocol = engineOrModel.protocol;

  const strStatus = String(engineOrModel.status || '').toUpperCase();
  let status = 'Ready';
  if (strStatus === 'RUNNING') status = 'Running';
  else if (strStatus === 'PAUSED') status = 'Paused';
  else if (strStatus === 'COMPLETED') status = 'Completed';
  else if (strStatus === 'ERROR') status = 'Error';
  else status = 'Ready';

  const currentTimeUs = isEngine
    ? (engineOrModel as SimulationEngine).clock.currentTime
    : (engineOrModel as SimulationModel).current_time;
  const currentSimulationTimeMs = currentTimeUs / 1000;

  const metrics = isEngine
    ? (engineOrModel as SimulationEngine).getMetrics()
    : (engineOrModel as SimulationModel).metrics;

  const rawConfig = isEngine
    ? (engineOrModel as SimulationEngine).config
    : (engineOrModel as SimulationModel).config;

  const normConfig = normalizeConfig(rawConfig);

  let stations: any[] = [];
  if (isEngine) {
    const engine = engineOrModel as SimulationEngine;
    stations = Array.from(engine.stations.values()).map((s) => ({
      stationId: s.id,
      stationNumber: s.station_index,
      status: s.state,
      queueLength: s.queue_length,
      currentFrameId: engine.activeStationFrames.get(s.id)?.id,
      retryCount: s.backoff_count,
      backoffRemaining: s.next_attempt_time ? Math.max(0, (s.next_attempt_time - engine.clock.currentTime) / 1000) : 0,
      successfulTransmissions: s.frames_transmitted,
      collisions: s.frames_collided,
      retransmissions: s.backoff_count,
      droppedFrames: s.frames_dropped,
    }));
  } else if ((engineOrModel as SimulationModel).stations) {
    stations = (engineOrModel as SimulationModel).stations!.map((s) => ({
      stationId: s.id,
      stationNumber: s.station_index,
      status: s.state,
      queueLength: s.queue_length,
      retryCount: s.backoff_count,
      successfulTransmissions: s.frames_transmitted,
      collisions: s.frames_collided,
      retransmissions: s.backoff_count,
      droppedFrames: s.frames_dropped,
    }));
  }

  let medium = {
    status: 'IDLE',
    activeFrameIds: [] as string[],
    activeStations: [] as string[],
    inCollision: false,
  };

  if (isEngine) {
    const engine = engineOrModel as SimulationEngine;
    const activeTx = engine.medium.getActiveTransmissions();
    const isBusy = activeTx.length > 0;
    const inCollision = activeTx.some((tx) => tx.isCollided);
    medium = {
      status: inCollision ? 'COLLISION' : isBusy ? 'BUSY' : 'IDLE',
      activeFrameIds: activeTx.map((t) => t.frameId),
      activeStations: activeTx.map((t) => t.stationId),
      inCollision,
    };
  }

  const formattedMetrics = {
    generatedFrames: metrics?.total_frames_generated ?? 0,
    successfulFrames: metrics?.total_frames_transmitted ?? 0,
    collisions: metrics?.total_collisions ?? 0,
    collidedAttempts: metrics?.collided_attempts ?? metrics?.total_collisions ?? 0,
    retransmissions: metrics?.retransmissions ?? metrics?.total_collisions ?? 0,
    droppedFrames: metrics?.total_dropped ?? 0,
    throughputBps: metrics?.throughput_bps ?? 0,
    goodputBps: metrics?.goodput_bps ?? metrics?.throughput_bps ?? 0,
    channelUtilization: metrics?.channel_efficiency ?? 0,
    averageDelayMs: (metrics?.average_latency_us ?? 0) / 1000,
    elapsedMs: currentSimulationTimeMs,
    isFinal: status === 'Completed',
    collisionIncidents: metrics?.collision_incidents ?? 0,
    packetDeliveryRatio: metrics?.packet_delivery_ratio ?? 0,
    dropRate: metrics?.drop_rate ?? 0,
    totalSlots: metrics?.total_slots,
    idleSlots: metrics?.idle_slots,
    successfulSlots: metrics?.successful_slots,
    collidedSlots: metrics?.collided_slots,
    slotUtilization: metrics?.slot_utilization,
    theoreticalEfficiency: metrics?.theoretical_efficiency,
  };

  return {
    id,
    protocol,
    status,
    configuration: normConfig,
    randomSeed: normConfig.randomSeed ?? 42,
    engineVersion: env.ENGINE_VERSION,
    currentSimulationTimeMs,
    createdAt: (engineOrModel as any).created_at ? new Date((engineOrModel as any).created_at).toISOString() : new Date().toISOString(),
    stations,
    medium,
    metrics: formattedMetrics,
    current_time: currentTimeUs,
    max_simulation_time: normConfig.simulation_time_us,
    config: normConfig,
  };
}
