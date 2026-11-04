import { SimulationClock } from './SimulationClock.js';
import { EventQueue } from './EventQueue.js';
import { RandomGenerator } from './RandomGenerator.js';
import { SharedMedium } from './SharedMedium.js';
import { TrafficGenerator } from './TrafficGenerator.js';
import { BackoffManager } from './BackoffManager.js';
import { BaseProtocol, ProtocolContext } from './protocols/BaseProtocol.js';
import { PureAlohaProtocol } from './protocols/PureAloha.js';
import { SlottedAlohaProtocol } from './protocols/SlottedAloha.js';
import { CSMAProtocol } from './protocols/CSMA.js';
import { CSMACDProtocol } from './protocols/CSMACD.js';
import { SimulationConfig, SimulationModel } from '../types/simulation.types.js';
import { StationModel } from '../types/station.types.js';
import { FrameModel } from '../types/frame.types.js';
import { SimulationEventModel } from '../types/event.types.js';
import { SimulationMetricsModel } from '../types/metrics.types.js';
import { PROTOCOL_TYPES, SIMULATION_STATUS, EVENT_TYPES, STATION_STATES } from '../config/constants.js';

export class SimulationEngine {
  public id: string;
  public config: SimulationConfig;
  public clock: SimulationClock;
  public rng: RandomGenerator;
  public eventQueue: EventQueue;
  public medium: SharedMedium;
  public trafficGenerator: TrafficGenerator;
  public backoffManager: BackoffManager;
  public protocol: BaseProtocol;

  public stations: Map<string, StationModel> = new Map();
  public stationQueues: Map<string, FrameModel[]> = new Map();
  public activeStationFrames: Map<string, FrameModel> = new Map();
  public stationRngs: Map<string, RandomGenerator> = new Map();
  public frames: Map<string, FrameModel> = new Map();
  public events: SimulationEventModel[] = [];

  public status: (typeof SIMULATION_STATUS)[keyof typeof SIMULATION_STATUS] = SIMULATION_STATUS.IDLE;
  public sequenceNumberCounter: number = 0;
  public frameCounter: number = 0;

  // Real-time event listener callback
  public onEventCallback?: (event: SimulationEventModel) => void;

  constructor(id: string, config: SimulationConfig) {
    this.id = id;
    this.config = config;
    this.clock = new SimulationClock();
    this.rng = new RandomGenerator(config.random_seed);
    this.eventQueue = new EventQueue();
    this.medium = new SharedMedium(config.propagation_delay_us);
    this.trafficGenerator = new TrafficGenerator(
      this.rng,
      config.arrival_rate_lambda,
      config.traffic_distribution
    );
    this.backoffManager = new BackoffManager(
      this.rng,
      config.slot_time_us ?? 51.2,
      10,
      config.max_retry_limit ?? 16
    );

    // Initialize per-station deterministic isolated RNGs
    for (let i = 1; i <= config.num_stations; i++) {
      this.stationRngs.set(`station_${i}`, this.rng.createStationRng(i));
    }

    const ctx: ProtocolContext = {
      clock: this.clock,
      eventQueue: this.eventQueue,
      medium: this.medium,
      rng: this.rng,
      backoffManager: this.backoffManager,
      stations: this.stations,
      stationQueues: this.stationQueues,
      activeStationFrames: this.activeStationFrames,
      stationRngs: this.stationRngs,
      config: this.config,
      recordEvent: (type, stationId, frameId, details) =>
        this.recordEvent(type, stationId, frameId, details),
      recordFrameTransmitted: (frame, success) => this.recordFrameTransmitted(frame, success),
      recordCollision: (frame) => this.recordCollision(frame),
      recordDrop: (frame) => this.recordDrop(frame),
    };

    switch (config.protocol) {
      case PROTOCOL_TYPES.PURE_ALOHA:
        this.protocol = new PureAlohaProtocol(ctx);
        break;
      case PROTOCOL_TYPES.SLOTTED_ALOHA:
        this.protocol = new SlottedAlohaProtocol(ctx);
        break;
      case PROTOCOL_TYPES.CSMA:
      case PROTOCOL_TYPES.CSMA_1_PERSISTENT:
        this.protocol = new CSMAProtocol(ctx, '1-PERSISTENT');
        break;
      case PROTOCOL_TYPES.CSMA_NON_PERSISTENT:
        this.protocol = new CSMAProtocol(ctx, 'NON-PERSISTENT');
        break;
      case PROTOCOL_TYPES.CSMA_P_PERSISTENT:
        this.protocol = new CSMAProtocol(ctx, 'P-PERSISTENT');
        break;
      case PROTOCOL_TYPES.CSMA_CD:
        this.protocol = new CSMACDProtocol(ctx);
        break;
      default:
        this.protocol = new PureAlohaProtocol(ctx);
        break;
    }

    this.initializeStations();
  }

  private initializeStations(): void {
    for (let i = 0; i < this.config.num_stations; i++) {
      const stationId = `station_${i + 1}`;
      const station: StationModel = {
        id: stationId,
        simulation_id: this.id,
        station_index: i + 1,
        name: `Station ${i + 1}`,
        state: STATION_STATES.IDLE,
        frames_generated: 0,
        frames_transmitted: 0,
        frames_collided: 0,
        frames_dropped: 0,
        backoff_count: 0,
        current_backoff_window: 0,
        next_attempt_time: null,
        queue_length: 0,
      };

      this.stations.set(stationId, station);
      this.stationQueues.set(stationId, []);

      // Schedule initial frame arrival
      const firstArrivalUs = this.trafficGenerator.nextIntervalUs();
      this.scheduleFrameArrival(station, firstArrivalUs);
    }
  }

  private scheduleFrameArrival(station: StationModel, arrivalTime: number): void {
    if (arrivalTime > this.config.simulation_time_us) return;

    this.eventQueue.push({
      id: `arrival_${station.id}_${arrivalTime}`,
      time: arrivalTime,
      priority: 0, // Frame generation has highest precedence
      type: 'FRAME_ARRIVAL',
      stationId: station.id,
      handler: () => {
        this.generateFrame(station);
        // Schedule next frame arrival for this station
        const nextInterval = this.trafficGenerator.nextIntervalUs();
        this.scheduleFrameArrival(station, this.clock.currentTime + nextInterval);
      },
    });
  }

  private generateFrame(station: StationModel): void {
    this.frameCounter += 1;
    const frameId = `frame_${this.frameCounter}`;
    const frame: FrameModel = {
      id: frameId,
      simulation_id: this.id,
      frame_id: this.frameCounter,
      station_id: station.id,
      size_bytes: this.config.frame_size_bytes,
      generation_time: this.clock.currentTime,
      transmission_start_time: null,
      transmission_end_time: null,
      status: 'QUEUED',
      attempt_count: 0,
      collision_count: 0,
    };

    station.frames_generated += 1;
    this.frames.set(frameId, frame);

    this.recordEvent(EVENT_TYPES.FRAME_GENERATED, station.id, frameId, {
      frameId: frame.frame_id,
      sizeBytes: frame.size_bytes,
      generationTime: frame.generation_time,
    });

    this.protocol.onFrameGenerated(station, frame);
  }

  public recordEvent(
    eventType: string,
    stationId: string | null,
    frameId: string | null,
    details: Record<string, unknown>
  ): SimulationEventModel {
    this.sequenceNumberCounter += 1;
    const timeMs = Number((this.clock.currentTime / 1000).toFixed(3));
    const eventId = `evt_${this.id}_${this.sequenceNumberCounter}`;

    let message = `${eventType} at ${timeMs.toFixed(2)}ms`;
    if (details.message && typeof details.message === 'string') {
      message = details.message;
    } else if (eventType === EVENT_TYPES.FRAME_GENERATED) {
      message = `Station ${stationId ?? ''} generated ${frameId ?? 'frame'} (${details.sizeBytes ?? this.config.frame_size_bytes} bytes)`;
    } else if (eventType === EVENT_TYPES.TRANSMISSION_STARTED) {
      message = `Station ${stationId ?? ''} started transmitting ${frameId ?? 'frame'}`;
    } else if (eventType === EVENT_TYPES.TRANSMISSION_COMPLETED) {
      message = `Station ${stationId ?? ''} successfully delivered ${frameId ?? 'frame'}`;
    } else if (eventType === EVENT_TYPES.COLLISION_DETECTED) {
      message = `Collision detected on shared channel for ${frameId ?? 'frame'}`;
    } else if (eventType === EVENT_TYPES.BACKOFF_STARTED) {
      message = `Station ${stationId ?? ''} entered backoff for ${(Number(details.delayUs ?? 0) / 1000).toFixed(2)}ms`;
    } else if (eventType === EVENT_TYPES.BACKOFF_COMPLETED) {
      message = `Station ${stationId ?? ''} completed backoff delay, ready to retransmit`;
    } else if (eventType === EVENT_TYPES.FRAME_DROPPED) {
      message = `Station ${stationId ?? ''} dropped ${frameId ?? 'frame'} (exceeded retry limit)`;
    } else if (eventType === EVENT_TYPES.CARRIER_SENSED_BUSY) {
      message = `Station ${stationId ?? ''} sensed channel busy, deferring transmission`;
    } else if (eventType === EVENT_TYPES.CARRIER_SENSED_IDLE) {
      message = `Station ${stationId ?? ''} sensed channel idle, proceeding to transmit`;
    } else if (eventType === EVENT_TYPES.SIMULATION_STARTED) {
      message = `Simulation started (duration: ${(this.config.simulation_time_us / 1000).toFixed(0)}ms)`;
    } else if (eventType === EVENT_TYPES.SIMULATION_PAUSED) {
      message = `Simulation execution paused at ${timeMs.toFixed(2)}ms`;
    } else if (eventType === EVENT_TYPES.SIMULATION_RESUMED) {
      message = `Simulation execution resumed at ${timeMs.toFixed(2)}ms`;
    } else if (eventType === EVENT_TYPES.SIMULATION_COMPLETED) {
      message = `Simulation completed at ${timeMs.toFixed(2)}ms`;
    } else if (eventType === EVENT_TYPES.SIMULATION_RESET) {
      message = `Simulation state reset to initial conditions`;
    }

    const evt: SimulationEventModel = {
      eventId,
      simulationId: this.id,
      sequenceNumber: this.sequenceNumberCounter,
      simulationTimeMs: timeMs,
      eventType,
      stationIds: stationId ? [stationId] : [],
      frameId: frameId ?? null,
      message,
      payload: details,
      // Backwards compatibility aliases
      id: eventId,
      simulation_id: this.id,
      sequence_number: this.sequenceNumberCounter,
      timestamp: this.clock.currentTime,
      event_type: eventType,
      station_id: stationId,
      frame_id: frameId,
      details,
    };

    this.events.push(evt);

    if (this.onEventCallback) {
      try {
        this.onEventCallback(evt);
      } catch {
        // Safe callback execution
      }
    }

    return evt;
  }

  public recordFrameTransmitted(_frame: FrameModel, _success: boolean): void {
    // Recorded directly on frame and station
  }

  public recordCollision(_frame: FrameModel): void {
    // Recorded directly on frame and station
  }

  public recordDrop(_frame: FrameModel): void {
    // Recorded directly on frame and station
  }

  /**
   * Run simulation up to targetTimeUs (or max simulation time).
   */
  public runUntil(targetTimeUs: number): void {
    const limit = Math.min(targetTimeUs, this.config.simulation_time_us);
    this.status = SIMULATION_STATUS.RUNNING;

    while (!this.eventQueue.isEmpty()) {
      const nextEvent = this.eventQueue.peek();
      if (!nextEvent || nextEvent.time > limit) {
        break;
      }

      const evt = this.eventQueue.pop()!;
      this.clock.advanceTo(evt.time);
      evt.handler();
    }

    // All events up to limit have been processed; advance clock to limit
    if (this.clock.currentTime < limit) {
      this.clock.advanceTo(limit);
    }

    if (this.clock.currentTime >= this.config.simulation_time_us) {
      this.status = SIMULATION_STATUS.COMPLETED;
      this.recordEvent(EVENT_TYPES.SIMULATION_COMPLETED, null, null, {
        finalTimeUs: this.clock.currentTime,
      });
    }
  }

  /**
   * Step the simulation by executing a fixed number of events or advancing time.
   */
  public step(stepCount: number = 1, deltaUs?: number): void {
    this.status = SIMULATION_STATUS.RUNNING;

    if (deltaUs && deltaUs > 0) {
      this.runUntil(this.clock.currentTime + deltaUs);
      return;
    }

    for (let i = 0; i < stepCount; i++) {
      if (this.eventQueue.isEmpty() || this.clock.currentTime >= this.config.simulation_time_us) {
        this.status = SIMULATION_STATUS.COMPLETED;
        break;
      }
      const evt = this.eventQueue.pop()!;
      this.clock.advanceTo(evt.time);
      evt.handler();
    }
  }

  public pause(): void {
    this.status = SIMULATION_STATUS.PAUSED;
    this.recordEvent(EVENT_TYPES.SIMULATION_PAUSED, null, null, {
      currentTime: this.clock.currentTime,
    });
  }

  public resume(): void {
    this.status = SIMULATION_STATUS.RUNNING;
    this.recordEvent(EVENT_TYPES.SIMULATION_RESUMED, null, null, {
      currentTime: this.clock.currentTime,
    });
  }

  public reset(): void {
    this.clock.reset();
    this.eventQueue.clear();
    this.medium.reset();
    this.stations.clear();
    this.stationQueues.clear();
    this.activeStationFrames.clear();
    this.stationRngs.clear();
    this.frames.clear();
    this.events = [];
    this.sequenceNumberCounter = 0;
    this.frameCounter = 0;
    this.status = SIMULATION_STATUS.RESET;

    this.rng = new RandomGenerator(this.config.random_seed);
    for (let i = 1; i <= this.config.num_stations; i++) {
      this.stationRngs.set(`station_${i}`, this.rng.createStationRng(i));
    }

    this.trafficGenerator = new TrafficGenerator(
      this.rng,
      this.config.arrival_rate_lambda,
      this.config.traffic_distribution
    );

    this.initializeStations();
    this.recordEvent(EVENT_TYPES.SIMULATION_RESET, null, null, {});
  }

  /**
   * Calculates comprehensive simulation metrics.
   */
  public getMetrics(): SimulationMetricsModel {
    let totalGenerated = 0;
    let totalTransmitted = 0;
    let totalCollisions = 0;
    let totalDropped = 0;
    let totalLatencyUs = 0;
    let totalAttempts = 0;
    let totalRetransmissions = 0;
    let totalCollidedAttempts = 0;

    for (const station of this.stations.values()) {
      totalGenerated += station.frames_generated;
      totalTransmitted += station.frames_transmitted;
      totalCollisions += station.frames_collided;
      totalDropped += station.frames_dropped;
    }

    for (const frame of this.frames.values()) {
      if (frame.status === 'SUCCESSFUL' && frame.transmission_end_time !== null) {
        totalLatencyUs += Math.max(0, frame.transmission_end_time - frame.generation_time);
      }
      totalAttempts += frame.attempt_count;
      if (frame.attempt_count > 1) {
        totalRetransmissions += frame.attempt_count - 1;
      }
      if (frame.attempts && frame.attempts.length > 0) {
        for (const att of frame.attempts) {
          if (att.status === 'COLLIDED' || att.status === 'ABORTED') {
            totalCollidedAttempts += 1;
          }
        }
      }
    }

    if (totalCollidedAttempts === 0 && totalCollisions > 0) {
      totalCollidedAttempts = totalCollisions;
    }

    const elapsedSeconds = Math.max(1e-6, this.clock.currentTime / 1_000_000);
    const deliveredBits = totalTransmitted * this.config.frame_size_bytes * 8;
    const throughputBps = Number((deliveredBits / elapsedSeconds).toFixed(2));
    const goodputBps = throughputBps;

    const channelEfficiency =
      this.config.channel_bandwidth_bps > 0
        ? Math.min(1.0, Number((throughputBps / this.config.channel_bandwidth_bps).toFixed(4)))
        : 0.0;

    const collisionIncidents = this.medium.getCollisionIncidents();
    const collisionRate =
      totalAttempts > 0
        ? Math.min(1.0, Number((totalCollidedAttempts / totalAttempts).toFixed(4)))
        : 0.0;

    const pdr =
      totalGenerated > 0
        ? Math.min(100.0, Number(((totalTransmitted / totalGenerated) * 100).toFixed(2)))
        : 0.0;

    const dropRate =
      totalGenerated > 0
        ? Math.min(100.0, Number(((totalDropped / totalGenerated) * 100).toFixed(2)))
        : 0.0;

    const avgLatency =
      totalTransmitted > 0 ? Number((totalLatencyUs / totalTransmitted).toFixed(2)) : 0.0;
    const avgAttempts =
      totalTransmitted > 0 ? Number((totalAttempts / totalTransmitted).toFixed(2)) : 0.0;

    const channelTimes = this.medium.getChannelTimes(this.clock.currentTime);

    const protocolSpecific = this.protocol.getProtocolMetrics
      ? this.protocol.getProtocolMetrics()
      : {};

    return {
      simulation_id: this.id,
      total_frames_generated: totalGenerated,
      total_frames_transmitted: totalTransmitted,
      total_collisions: totalCollisions,
      total_dropped: totalDropped,
      collision_rate: collisionRate,
      throughput_bps: throughputBps,
      goodput_bps: goodputBps,
      channel_efficiency: channelEfficiency,
      average_latency_us: avgLatency,
      average_attempts: avgAttempts,
      channel_busy_time_us: channelTimes.busyTimeUs,
      channel_idle_time_us: channelTimes.idleTimeUs,
      channel_collision_time_us: channelTimes.collisionTimeUs,
      theoretical_efficiency: this.calculateTheoreticalEfficiency(),
      collision_incidents: collisionIncidents,
      collided_attempts: totalCollidedAttempts,
      retransmissions: totalRetransmissions,
      packet_delivery_ratio: pdr,
      drop_rate: dropRate,
      ...protocolSpecific,
    };
  }

  /**
   * Theoretical maximum channel efficiency based on classic network formulas.
   */
  public calculateTheoreticalEfficiency(): number {
    switch (this.config.protocol) {
      case PROTOCOL_TYPES.PURE_ALOHA:
        // S = G * e^(-2G), max is 1 / (2e) ≈ 0.184
        return 1.0 / (2.0 * Math.E);
      case PROTOCOL_TYPES.SLOTTED_ALOHA:
        // S = G * e^(-G), max is 1 / e ≈ 0.368
        return 1.0 / Math.E;
      case PROTOCOL_TYPES.CSMA:
      case PROTOCOL_TYPES.CSMA_1_PERSISTENT:
        // Standard approximation: ~0.53
        return 0.53;
      case PROTOCOL_TYPES.CSMA_NON_PERSISTENT:
        // Standard approximation: ~0.81
        return 0.81;
      case PROTOCOL_TYPES.CSMA_P_PERSISTENT:
        // Dependent on p, typically ~0.70 to ~0.85
        return 0.78;
      case PROTOCOL_TYPES.CSMA_CD: {
        // Ethernet 1 / (1 + 5 * a) where a = propagation_delay / frame_transmission_time
        const tf =
          (this.config.frame_size_bytes * 8) / (this.config.channel_bandwidth_bps / 1_000_000);
        const a = this.config.propagation_delay_us / Math.max(1, tf);
        return 1.0 / (1.0 + 5.0 * a);
      }
      default:
        return 0.368;
    }
  }

  public toModel(): SimulationModel {
    return {
      id: this.id,
      name: this.config.name ?? null,
      protocol: this.config.protocol,
      status: this.status,
      current_time: this.clock.currentTime,
      max_simulation_time: this.config.simulation_time_us,
      random_seed: this.config.random_seed ?? null,
      config: this.config,
      created_at: new Date(),
      updated_at: new Date(),
      stations: Array.from(this.stations.values()),
      frames: Array.from(this.frames.values()),
      events: this.events,
      metrics: this.getMetrics(),
    };
  }
}
