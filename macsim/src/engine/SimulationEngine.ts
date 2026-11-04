import type {
  SimulationConfig,
  SimulationEvent,
  SimulationMetrics,
  StationSnapshot,
} from '../types';

interface QueuedFrame {
  id: string;
  generatedAtMs: number;
  retries: number;
}

interface ActiveFrame extends QueuedFrame {
  stationId: string;
  startedAtMs: number;
  remainingTicks: number;
  collided: boolean;
}

type Listener = (engine: SimulationEngine) => void;

const DEFAULT_MAX_RETRIES = 12;
const DEFAULT_MAX_BACKOFF_SLOTS = 16;

export class SimulationEngine {
  readonly config: SimulationConfig;
  readonly tickDurationMs: number;
  time = 0;
  running = false;
  completed = false;
  playbackSpeed = 1;
  stations: StationSnapshot[] = [];
  events: SimulationEvent[] = [];
  metrics: SimulationMetrics = this.emptyMetrics();

  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<Listener>();
  private queues: QueuedFrame[][] = [];
  private activeFrames: ActiveFrame[] = [];
  private backoffUntil: number[] = [];
  private nextArrivalAt: number[] = [];
  private randomState: number;
  private frameSequence = 0;
  private busyTicks = 0;
  private totalDelayMs = 0;
  private delayedFrames = 0;
  private readonly frameDurationMs: number;
  private readonly frameTicks: number;
  private readonly slotTicks: number;
  private readonly initialSeed: number;

  constructor(config: SimulationConfig) {
    const seed = config.randomSeed ?? Math.floor(Math.random() * 2_147_483_648);
    const normalizedConfig: SimulationConfig = {
      ...config,
      trafficModel: config.trafficModel ?? 'poisson',
      trafficIntensity: config.trafficIntensity ?? 0.5,
      randomSeed: seed,
    };
    this.validateConfig(normalizedConfig);
    this.config = normalizedConfig;
    this.frameDurationMs = (normalizedConfig.frameSizeBytes * 8 * 1000) / normalizedConfig.dataRateBps;
    this.tickDurationMs = Math.max(0.1, this.frameDurationMs / 2, normalizedConfig.durationMs / 10_000);
    this.frameTicks = Math.max(1, Math.ceil(this.frameDurationMs / this.tickDurationMs));
    this.slotTicks = Math.max(
      1,
      Math.round((normalizedConfig.slotDurationMs ?? this.frameDurationMs) / this.tickDurationMs),
    );
    this.initialSeed = seed >>> 0;
    this.randomState = this.initialSeed;
    this.initializeStations();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.completed || this.running) return;
    this.running = true;
    this.notify();
    this.scheduleNextTick(0);
  }

  pause(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.running = false;
    this.notify();
  }

  resume(): void {
    this.start();
  }

  setPlaybackSpeed(speed: number): void {
    if (![0.25, 0.5, 1, 2, 4].includes(speed)) {
      throw new Error('Playback speed must be one of the supported values.');
    }
    this.playbackSpeed = speed;
    if (this.running) {
      if (this.timer !== null) clearTimeout(this.timer);
      this.scheduleNextTick(0);
    }
  }

  step(): void {
    if (this.running || this.completed) return;
    this.advanceOneTick();
  }

  reset(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.running = false;
    this.completed = false;
    this.time = 0;
    this.events = [];
    this.metrics = this.emptyMetrics();
    this.queues = [];
    this.activeFrames = [];
    this.backoffUntil = [];
    this.nextArrivalAt = [];
    this.randomState = this.initialSeed;
    this.frameSequence = 0;
    this.busyTicks = 0;
    this.totalDelayMs = 0;
    this.delayedFrames = 0;
    this.initializeStations();
    this.notify();
  }

  destroy(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.running = false;
    this.listeners.clear();
  }

  private initializeStations(): void {
    this.stations = Array.from({ length: this.config.stationCount }, (_, index) => ({
      stationId: `PC-${String(index + 1).padStart(2, '0')}`,
      status: 'IDLE',
      queueLength: 0,
      retryCount: 0,
    }));
    this.queues = this.stations.map(() => []);
    this.backoffUntil = this.stations.map(() => 0);
    this.nextArrivalAt = this.stations.map(() =>
      this.config.trafficModel === 'uniform'
        ? this.random() * this.sampleInterarrival()
        : this.sampleInterarrival(),
    );
  }

  private emptyMetrics(): SimulationMetrics {
    return {
      successfulFrames: 0,
      collisions: 0,
      retransmissions: 0,
      channelUtilization: 0,
      elapsedMs: 0,
    };
  }

  private validateConfig(config: SimulationConfig): void {
    if (!['PURE_ALOHA', 'SLOTTED_ALOHA', 'CSMA', 'CSMA_CD'].includes(config.protocol)) {
      throw new Error('Select one of the supported MAC protocols.');
    }
    if (config.trafficModel !== 'poisson' && config.trafficModel !== 'uniform') {
      throw new Error('Select a supported traffic generation model.');
    }
    if (!Number.isInteger(config.stationCount) || config.stationCount < 2 || config.stationCount > 64) {
      throw new Error('Station count must be an integer from 2 to 64.');
    }
    if (!Number.isFinite(config.frameSizeBytes) || config.frameSizeBytes < 64 || config.frameSizeBytes > 65535) {
      throw new Error('Frame size must be from 64 to 65,535 bytes.');
    }
    if (!Number.isFinite(config.dataRateBps) || config.dataRateBps < 1000 || config.dataRateBps > 1_000_000_000) {
      throw new Error('Data rate must be from 1,000 to 1,000,000,000 bits per second.');
    }
    if (!Number.isFinite(config.durationMs) || config.durationMs <= 0 || config.durationMs > 120_000) {
      throw new Error('Duration must be greater than 0 and no more than 120,000 ms.');
    }
    if (!Number.isFinite(config.trafficIntensity) || (config.trafficIntensity ?? 0) <= 0 || (config.trafficIntensity ?? 0) > 5) {
      throw new Error('Traffic intensity must be greater than 0 and no more than 5.');
    }
    const expectedFrames =
      config.stationCount *
      (config.trafficIntensity ?? 0.5) *
      config.durationMs /
      ((config.frameSizeBytes * 8 * 1000) / config.dataRateBps);
    if (expectedFrames > 50_000) {
      throw new Error('These settings may generate more than 50,000 frames. Reduce duration or traffic intensity, or increase frame size.');
    }
    if (
      config.randomSeed !== undefined &&
      (!Number.isInteger(config.randomSeed) || config.randomSeed < 0 || config.randomSeed > 2_147_483_647)
    ) {
      throw new Error('Random seed must be an integer from 0 to 2,147,483,647.');
    }
    if (config.protocol === 'SLOTTED_ALOHA' && (!config.slotDurationMs || config.slotDurationMs <= 0)) {
      throw new Error('Slotted ALOHA requires a positive slot duration.');
    }
    if (config.propagationDelayMs !== undefined && config.propagationDelayMs < 0) {
      throw new Error('Propagation delay cannot be negative.');
    }
    if (config.maxRetries !== undefined && (!Number.isInteger(config.maxRetries) || config.maxRetries < 1 || config.maxRetries > 32)) {
      throw new Error('Maximum retries must be an integer from 1 to 32.');
    }
    if (
      config.maxBackoffSlots !== undefined &&
      (!Number.isInteger(config.maxBackoffSlots) || config.maxBackoffSlots < 1 || config.maxBackoffSlots > 1024)
    ) {
      throw new Error('Maximum backoff slots must be an integer from 1 to 1,024.');
    }
  }

  private random(): number {
    this.randomState = (1664525 * this.randomState + 1013904223) >>> 0;
    return this.randomState / 0x1_0000_0000;
  }

  private sampleInterarrival(): number {
    const intensity = this.config.trafficIntensity ?? 0.5;
    const meanInterval = this.frameDurationMs / intensity;
    return this.config.trafficModel === 'uniform'
      ? meanInterval
      : -Math.log(1 - this.random()) * meanInterval;
  }

  private scheduleNextTick(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.advanceOneTick();
      if (this.running) this.scheduleNextTick(20 / this.playbackSpeed);
    }, delayMs);
  }

  private advanceOneTick(): void {
    if (this.completed) return;
    const previousTime = this.time;
    this.time = Math.min(this.config.durationMs, this.time + this.tickDurationMs);
    const elapsed = this.time - previousTime;
    const tickIndex = Math.round(this.time / this.tickDurationMs);

    this.generateArrivals();
    this.updateBackoffStatuses();

    const candidates = this.stations
      .map((station, index) => ({ station, index }))
      .filter(({ index }) => this.queues[index].length > 0 && this.backoffUntil[index] <= this.time);

    const isSlotBoundary = tickIndex % this.slotTicks === 0;
    const mayStart =
      this.config.protocol !== 'SLOTTED_ALOHA' || isSlotBoundary;

    if (mayStart && candidates.length > 0) {
      this.processTransmissions(candidates);
    }

    if (this.activeFrames.length > 0) this.busyTicks += elapsed / this.tickDurationMs;
    this.finishTransmissions();
    this.updateStationSnapshots();
    this.updateMetrics();

    if (this.time >= this.config.durationMs) {
      this.completed = true;
      this.running = false;
      this.pushEvent('Simulation completed', [], 'Simulation completed.');
    }
    this.notify();

    if (this.completed && this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private generateArrivals(): void {
    for (let index = 0; index < this.stations.length; index += 1) {
      while (this.nextArrivalAt[index] <= this.time) {
        const frame: QueuedFrame = {
          id: `F-${String(++this.frameSequence).padStart(4, '0')}`,
          generatedAtMs: this.nextArrivalAt[index],
          retries: 0,
        };
        this.queues[index].push(frame);
        const stationId = this.stations[index].stationId;
        this.pushEvent('Frame generated', [stationId], `${stationId} generated ${frame.id}.`, frame.id);
        if (
          this.activeFrames.length > 0 &&
          (this.config.protocol === 'CSMA' || this.config.protocol === 'CSMA_CD')
        ) {
          this.pushEvent('Channel sensed busy', [stationId], `${stationId} found the channel busy.`, frame.id);
        }
        this.nextArrivalAt[index] += this.sampleInterarrival();
      }
    }
  }

  private processTransmissions(candidates: { station: StationSnapshot; index: number }[]): void {
    const protocol = this.config.protocol;
    const canCollideWithBusyChannel = protocol === 'PURE_ALOHA' || protocol === 'SLOTTED_ALOHA';
    const canDetectCollision = protocol === 'CSMA_CD';
    const activeAtStart = [...this.activeFrames];
    const allowed = canCollideWithBusyChannel
      ? candidates
      : activeAtStart.length === 0
        ? [candidates[Math.floor(this.random() * candidates.length)]]
        : canDetectCollision &&
            this.time - Math.min(...activeAtStart.map(frame => frame.startedAtMs)) <=
              Math.max(this.config.propagationDelayMs ?? 0, this.tickDurationMs)
          ? [candidates[Math.floor(this.random() * candidates.length)]]
          : [];

    for (const candidate of allowed) {
      const queued = this.queues[candidate.index].shift();
      if (!queued) continue;

      const frame: ActiveFrame = {
        ...queued,
        stationId: candidate.station.stationId,
        startedAtMs: this.time,
        remainingTicks: this.frameTicks,
        collided: false,
      };
      if (this.activeFrames.length > 0) {
        const involved = [...this.activeFrames, frame];
        involved.forEach(active => {
          active.collided = true;
        });
        this.metrics.collisions += 1;
        const stationIds = [...new Set(involved.map(active => active.stationId))];
        this.pushEvent(
          'Collision detected',
          stationIds,
          `Collision involving ${stationIds.join(', ')}.`,
          frame.id,
        );
      }
      this.activeFrames.push(frame);
      if (queued.retries > 0) {
        this.metrics.retransmissions += 1;
        this.pushEvent(
          'Retransmission attempted',
          [frame.stationId],
          `${frame.stationId} retransmitted ${frame.id}.`,
          frame.id,
        );
      } else {
        this.pushEvent(
          'Transmission started',
          [frame.stationId],
          `${frame.stationId} started ${frame.id}.`,
          frame.id,
        );
      }
    }

    if (canDetectCollision && this.activeFrames.some(frame => frame.collided)) {
      const collidedFrames = this.activeFrames.filter(frame => frame.collided);
      this.activeFrames = this.activeFrames.filter(frame => !frame.collided);
      collidedFrames.forEach(frame => this.scheduleRetry(frame));
    }
  }

  private finishTransmissions(): void {
    const finished: ActiveFrame[] = [];
    this.activeFrames = this.activeFrames.filter(frame => {
      frame.remainingTicks -= 1;
      if (frame.remainingTicks <= 0) {
        finished.push(frame);
        return false;
      }
      return true;
    });

    for (const frame of finished) {
      if (frame.collided) {
        this.scheduleRetry(frame);
      } else {
        const stationIndex = this.stations.findIndex(station => station.stationId === frame.stationId);
        if (stationIndex >= 0) this.stations[stationIndex].status = 'SUCCESSFUL';
        this.metrics.successfulFrames += 1;
        this.totalDelayMs += Math.max(0, this.time - frame.generatedAtMs);
        this.delayedFrames += 1;
        this.pushEvent('Frame delivered', [frame.stationId], `${frame.id} delivered successfully.`, frame.id);
      }
    }
  }

  private scheduleRetry(frame: ActiveFrame): void {
    const index = this.stations.findIndex(station => station.stationId === frame.stationId);
    if (index < 0) return;
    const retries = frame.retries + 1;
    this.stations[index].retryCount = retries;
    const maxRetries = this.config.maxRetries ?? DEFAULT_MAX_RETRIES;
    if (retries > maxRetries) {
      this.pushEvent('Frame dropped', [frame.stationId], `${frame.id} dropped after ${maxRetries} retries.`, frame.id);
      return;
    }
    const window = Math.min(2 ** retries, this.config.maxBackoffSlots ?? DEFAULT_MAX_BACKOFF_SLOTS);
    const slots = Math.floor(this.random() * window) + 1;
    const delay = slots * (this.config.slotDurationMs ?? this.frameDurationMs);
    this.backoffUntil[index] = this.time + delay;
    this.queues[index].unshift({ id: frame.id, generatedAtMs: frame.generatedAtMs, retries });
    this.pushEvent(
      'Backoff started',
      [frame.stationId],
      `${frame.stationId} will retry ${frame.id} after ${slots} backoff slot${slots === 1 ? '' : 's'}.`,
      frame.id,
    );
  }

  private updateBackoffStatuses(): void {
    this.stations.forEach((station, index) => {
      if (this.backoffUntil[index] > this.time) {
        station.status = 'BACKOFF';
        station.backoffRemaining = this.backoffUntil[index] - this.time;
      } else {
        station.backoffRemaining = 0;
        if (station.status === 'SUCCESSFUL') station.status = 'IDLE';
      }
    });
  }

  private updateStationSnapshots(): void {
    this.stations.forEach((station, index) => {
      const active = this.activeFrames.find(frame => frame.stationId === station.stationId);
      station.queueLength = this.queues[index].length;
      station.currentFrameId = active?.id;
      if (active) {
        station.status = active.collided ? 'COLLISION' : 'TRANSMITTING';
      } else if (this.backoffUntil[index] > this.time) {
        station.status = 'BACKOFF';
      } else if (this.queues[index].length > 0) {
        station.status = this.config.protocol === 'CSMA' || this.config.protocol === 'CSMA_CD'
          ? 'SENSING'
          : 'WAITING';
      } else if (station.status !== 'SUCCESSFUL') {
        station.status = 'IDLE';
      }
    });
  }

  private updateMetrics(): void {
    const elapsedSeconds = this.time / 1000;
    const deliveredBits = this.metrics.successfulFrames * this.config.frameSizeBytes * 8;
    const utilization = Math.min(1, (this.busyTicks * this.tickDurationMs) / Math.max(this.time, this.tickDurationMs));
    this.metrics = {
      ...this.metrics,
      elapsedMs: this.time,
      throughputBps: elapsedSeconds > 0 ? deliveredBits / elapsedSeconds : 0,
      goodputBps: elapsedSeconds > 0 ? deliveredBits / elapsedSeconds : 0,
      channelUtilization: utilization,
      averageDelayMs: this.delayedFrames > 0 ? this.totalDelayMs / this.delayedFrames : undefined,
    };
  }

  private pushEvent(eventType: string, stationIds: string[], message: string, frameId?: string): void {
    this.events.push({
      eventId: `E-${String(this.events.length + 1).padStart(5, '0')}`,
      simulationTimeMs: this.time,
      eventType,
      stationIds,
      frameId,
      message,
    });
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this));
  }
}
