import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { SimulationEngine } from '../engine/SimulationEngine.js';
import { SimulationRepository } from '../repositories/SimulationRepository.js';
import { EventRepository } from '../repositories/EventRepository.js';
import { SSEManager } from '../realtime/SSEManager.js';
import { SimulationConfig, SimulationModel } from '../types/simulation.types.js';
import { SimulationMetricsModel } from '../types/metrics.types.js';
import { SIMULATION_STATUS, EVENT_TYPES } from '../config/constants.js';
import { formatSimulationDetail } from '../utils/formatters.js';

interface ActiveRunner {
  timer: NodeJS.Timeout;
  speed: number;
}

export class SimulationService {
  private static instance: SimulationService;
  private engines: Map<string, SimulationEngine> = new Map();
  private activeRunners: Map<string, ActiveRunner> = new Map();
  private simRepo: SimulationRepository;
  private eventRepo: EventRepository;
  private sseManager: SSEManager;

  private constructor(prisma: PrismaClient) {
    this.simRepo = new SimulationRepository(prisma);
    this.eventRepo = new EventRepository(prisma);
    this.sseManager = SSEManager.getInstance();
  }

  public static getInstance(prisma?: PrismaClient): SimulationService {
    if (!SimulationService.instance) {
      if (!prisma) {
        throw new Error('PrismaClient required for initial SimulationService instantiation');
      }
      SimulationService.instance = new SimulationService(prisma);
    }
    return SimulationService.instance;
  }

  public async createSimulation(config: SimulationConfig): Promise<SimulationModel> {
    const id = randomUUID();
    const engine = new SimulationEngine(id, config);

    // Attach SSE broadcaster to engine events
    engine.onEventCallback = (evt) => {
      this.sseManager.broadcast(id, evt);
    };

    this.engines.set(id, engine);
    await this.simRepo.create(id, config);

    return engine.toModel();
  }

  public async getOrLoadEngine(id: string): Promise<SimulationEngine | null> {
    const active = this.engines.get(id);
    if (active) return active;

    const sim = await this.simRepo.findById(id);
    if (!sim) return null;

    const engine = new SimulationEngine(id, sim.config);
    engine.onEventCallback = (evt) => {
      this.sseManager.broadcast(id, evt);
    };

    if (sim.current_time > 0) {
      engine.runUntil(sim.current_time);
    }
    engine.status = (sim.status as any) || SIMULATION_STATUS.READY;

    this.engines.set(id, engine);
    return engine;
  }

  public async getSimulation(id: string): Promise<SimulationModel | null> {
    const engine = await this.getOrLoadEngine(id);
    if (engine) {
      return engine.toModel();
    }
    return this.simRepo.findById(id);
  }

  public async listSimulations(limit: number = 50, offset: number = 0): Promise<SimulationModel[]> {
    return this.simRepo.findAll(limit, offset);
  }

  public async startSimulation(id: string, runToCompletion: boolean = false): Promise<SimulationModel> {
    const engine = await this.getOrLoadEngine(id);
    if (!engine) {
      throw new Error(`Simulation ${id} not found`);
    }

    // Stop existing runner if any
    this.stopRunner(id);

    // If completed or reset, re-initialize if needed
    if (engine.status === SIMULATION_STATUS.COMPLETED || engine.clock.currentTime >= engine.config.simulation_time_us) {
      engine.reset();
    }

    engine.status = SIMULATION_STATUS.RUNNING;
    engine.recordEvent(EVENT_TYPES.SIMULATION_STARTED, null, null, {
      durationUs: engine.config.simulation_time_us,
    });
    this.broadcastCurrentSnapshot(id, engine);

    if (runToCompletion) {
      // Synchronous run
      engine.runUntil(engine.config.simulation_time_us);
      await this.saveEngineState(id, engine);
      return engine.toModel();
    }

    // Interactive animated real-time ticker loop (40ms ticks)
    let speed = 1.0;
    const tickIntervalMs = 40;
    // Step roughly (sim_time / 100 ticks) per tick at 1x
    const stepDeltaUs = Math.max(5000, engine.config.simulation_time_us / 100);

    const timer = setInterval(async () => {
      const runner = this.activeRunners.get(id);
      const currentSpeed = runner ? runner.speed : speed;

      const targetUs = engine.clock.currentTime + stepDeltaUs * currentSpeed;
      engine.runUntil(targetUs);

      this.broadcastCurrentSnapshot(id, engine);

      if (engine.status === SIMULATION_STATUS.COMPLETED || engine.clock.currentTime >= engine.config.simulation_time_us) {
        this.stopRunner(id);
        engine.status = SIMULATION_STATUS.COMPLETED;
        const detail = formatSimulationDetail(engine);
        this.sseManager.broadcastComplete(id, detail.metrics);
        await this.saveEngineState(id, engine);
      }
    }, tickIntervalMs);

    this.activeRunners.set(id, { timer, speed });

    return engine.toModel();
  }

  public async pauseSimulation(id: string): Promise<SimulationModel> {
    const engine = await this.getOrLoadEngine(id);
    if (!engine) {
      throw new Error(`Simulation ${id} not found`);
    }

    this.stopRunner(id);
    engine.pause();
    this.broadcastCurrentSnapshot(id, engine);
    await this.saveEngineState(id, engine);

    return engine.toModel();
  }

  public async resumeSimulation(id: string): Promise<SimulationModel> {
    const engine = await this.getOrLoadEngine(id);
    if (!engine) {
      throw new Error(`Simulation ${id} not found`);
    }

    this.stopRunner(id);

    if (engine.status === SIMULATION_STATUS.COMPLETED || engine.clock.currentTime >= engine.config.simulation_time_us) {
      engine.reset();
    }

    engine.resume();
    this.broadcastCurrentSnapshot(id, engine);

    const tickIntervalMs = 40;
    const stepDeltaUs = Math.max(5000, engine.config.simulation_time_us / 100);

    const timer = setInterval(async () => {
      const runner = this.activeRunners.get(id);
      const currentSpeed = runner ? runner.speed : 1.0;

      const targetUs = engine.clock.currentTime + stepDeltaUs * currentSpeed;
      engine.runUntil(targetUs);

      this.broadcastCurrentSnapshot(id, engine);

      if (engine.status === SIMULATION_STATUS.COMPLETED || engine.clock.currentTime >= engine.config.simulation_time_us) {
        this.stopRunner(id);
        engine.status = SIMULATION_STATUS.COMPLETED;
        const detail = formatSimulationDetail(engine);
        this.sseManager.broadcastComplete(id, detail.metrics);
        await this.saveEngineState(id, engine);
      }
    }, tickIntervalMs);

    this.activeRunners.set(id, { timer, speed: 1.0 });

    return engine.toModel();
  }

  public async stepSimulation(
    id: string,
    stepCount: number = 1,
    deltaUs?: number
  ): Promise<SimulationModel> {
    const engine = await this.getOrLoadEngine(id);
    if (!engine) {
      throw new Error(`Simulation ${id} not found`);
    }

    this.stopRunner(id);
    engine.step(stepCount, deltaUs);
    this.broadcastCurrentSnapshot(id, engine);
    await this.saveEngineState(id, engine);

    return engine.toModel();
  }

  public async resetSimulation(id: string): Promise<SimulationModel> {
    const engine = await this.getOrLoadEngine(id);
    if (!engine) {
      throw new Error(`Simulation ${id} not found`);
    }

    this.stopRunner(id);
    engine.reset();
    this.broadcastCurrentSnapshot(id, engine);
    await this.saveEngineState(id, engine);

    return engine.toModel();
  }

  public setPlaybackSpeed(id: string, speed: number): void {
    const runner = this.activeRunners.get(id);
    if (runner) {
      runner.speed = speed;
    }
  }

  public async getMetrics(id: string): Promise<SimulationMetricsModel | null> {
    const engine = await this.getOrLoadEngine(id);
    if (engine) {
      return engine.getMetrics();
    }
    const sim = await this.simRepo.findById(id);
    return sim?.metrics ?? null;
  }

  public async getEvents(
    id: string,
    sinceSequence: number = 0,
    limit: number = 500
  ) {
    const engine = await this.getOrLoadEngine(id);
    if (engine && engine.events.length > 0) {
      return engine.events
        .filter((e) => (e.sequenceNumber ?? e.sequence_number ?? 0) > sinceSequence)
        .slice(0, limit);
    }
    return this.eventRepo.findBySimulation(id, sinceSequence, limit);
  }

  public async deleteSimulation(id: string): Promise<boolean> {
    this.stopRunner(id);
    this.engines.delete(id);
    return this.simRepo.delete(id);
  }

  private stopRunner(id: string): void {
    const runner = this.activeRunners.get(id);
    if (runner) {
      clearInterval(runner.timer);
      this.activeRunners.delete(id);
    }
  }

  private broadcastCurrentSnapshot(id: string, engine: SimulationEngine): void {
    const detail = formatSimulationDetail(engine);
    this.sseManager.broadcastSnapshot(id, {
      type: 'snapshot',
      status: detail.status,
      currentSimulationTimeMs: detail.currentSimulationTimeMs,
      stations: detail.stations,
      medium: detail.medium,
      metrics: detail.metrics,
    });
  }

  private async saveEngineState(id: string, engine: SimulationEngine): Promise<void> {
    try {
      const metrics = engine.getMetrics();
      await this.simRepo.updateState(id, engine.status, engine.clock.currentTime, metrics);
      await this.eventRepo.saveBatch(engine.events);
    } catch {
      // Safe background save
    }
  }
}
