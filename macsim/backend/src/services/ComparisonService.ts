import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { ComparisonRepository, ComparisonRunData } from '../repositories/ComparisonRepository.js';
import { SimulationEngine } from '../engine/SimulationEngine.js';
import { ProtocolType } from '../config/constants.js';

export interface SweepParams {
  name?: string;
  protocols: ProtocolType[];
  startLambda: number;
  endLambda: number;
  steps: number;
  numStations?: number;
  simulationTimeUs?: number;
  frameSizeBytes?: number;
  bandwidthBps?: number;
}

export class ComparisonService {
  private static instance: ComparisonService;
  private compRepo: ComparisonRepository;

  private constructor(prisma: PrismaClient) {
    this.compRepo = new ComparisonRepository(prisma);
  }

  public static getInstance(prisma?: PrismaClient): ComparisonService {
    if (!ComparisonService.instance) {
      if (!prisma) {
        throw new Error('PrismaClient required for initial ComparisonService instantiation');
      }
      ComparisonService.instance = new ComparisonService(prisma);
    }
    return ComparisonService.instance;
  }

  public async runSweep(params: SweepParams): Promise<any> {
    const comparisonId = randomUUID();
    const runs: ComparisonRunData[] = [];

    const numStations = params.numStations ?? 5;
    const simTimeUs = params.simulationTimeUs ?? 500_000.0;
    const frameSizeBytes = params.frameSizeBytes ?? 1500;
    const bandwidthBps = params.bandwidthBps ?? 10_000_000;

    const lambdaStep =
      params.steps > 1
        ? (params.endLambda - params.startLambda) / (params.steps - 1)
        : 0;

    for (let s = 0; s < params.steps; s++) {
      const lambda = params.startLambda + s * lambdaStep;

      for (const protocol of params.protocols) {
        const simId = randomUUID();
        const engine = new SimulationEngine(simId, {
          protocol,
          num_stations: numStations,
          simulation_time_us: simTimeUs,
          arrival_rate_lambda: lambda,
          traffic_distribution: 'POISSON',
          frame_size_bytes: frameSizeBytes,
          channel_bandwidth_bps: bandwidthBps,
          propagation_delay_us: 5.0,
          random_seed: 42 + s, // Deterministic seed per sweep step
        });

        // Run simulation
        engine.runUntil(simTimeUs);
        const metrics = engine.getMetrics();

        // Calculate normalized offered load G:
        // G = total_frames_generated * frame_tx_time / elapsed_time
        const frameDurationUs = (frameSizeBytes * 8) / (bandwidthBps / 1e6);
        const totalDurationUs = engine.clock.currentTime;
        const offeredLoad =
          totalDurationUs > 0
            ? (metrics.total_frames_generated * frameDurationUs) / totalDurationUs
            : 0;

        runs.push({
          simulation_id: simId,
          protocol,
          offered_load: Number(offeredLoad.toFixed(4)),
          throughput_bps: Number(metrics.throughput_bps.toFixed(2)),
          channel_efficiency: Number(metrics.channel_efficiency.toFixed(4)),
          collision_rate: Number(metrics.collision_rate.toFixed(4)),
          average_latency_us: Number(metrics.average_latency_us.toFixed(2)),
        });
      }
    }

    const saved = await this.compRepo.create(
      comparisonId,
      params.name || `Comparison_${new Date().toISOString()}`,
      runs
    );

    return saved;
  }

  public async getComparison(id: string): Promise<any> {
    return this.compRepo.findById(id);
  }

  public async listComparisons(limit: number = 20): Promise<any[]> {
    return this.compRepo.findAll(limit);
  }
}

