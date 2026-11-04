import { PrismaClient } from '@prisma/client';
import { SimulationModel, SimulationConfig } from '../types/simulation.types.js';
import { SimulationMetricsModel } from '../types/metrics.types.js';

export class SimulationRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  public async create(
    id: string,
    config: SimulationConfig,
    status: string = 'IDLE'
  ): Promise<SimulationModel> {
    const record = await this.prisma.simulation.create({
      data: {
        id,
        name: config.name ?? null,
        protocol: config.protocol,
        status,
        current_time: 0.0,
        max_simulation_time: config.simulation_time_us,
        random_seed: config.random_seed ?? null,
        config: JSON.stringify(config),
      },
    });

    return {
      id: record.id,
      name: record.name,
      protocol: record.protocol as any,
      status: record.status as any,
      current_time: record.current_time,
      max_simulation_time: record.max_simulation_time,
      random_seed: record.random_seed,
      config: JSON.parse(record.config),
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  }

  public async findById(id: string): Promise<SimulationModel | null> {
    const record = await this.prisma.simulation.findUnique({
      where: { id },
      include: {
        stations: true,
        frames: {
          take: 200,
          orderBy: { generation_time: 'asc' },
        },
        metrics: true,
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      name: record.name,
      protocol: record.protocol as any,
      status: record.status as any,
      current_time: record.current_time,
      max_simulation_time: record.max_simulation_time,
      random_seed: record.random_seed,
      config: JSON.parse(record.config),
      created_at: record.created_at,
      updated_at: record.updated_at,
      stations: record.stations.map((s) => ({
        id: s.id,
        simulation_id: s.simulation_id,
        station_index: s.station_index,
        name: s.name,
        state: s.state as any,
        frames_generated: s.frames_generated,
        frames_transmitted: s.frames_transmitted,
        frames_collided: s.frames_collided,
        frames_dropped: s.frames_dropped,
        backoff_count: s.backoff_count,
        current_backoff_window: s.current_backoff_window,
        next_attempt_time: s.next_attempt_time,
        queue_length: s.queue_length,
      })),
      frames: record.frames.map((f) => ({
        id: f.id,
        simulation_id: f.simulation_id,
        frame_id: f.frame_id,
        station_id: f.station_id,
        size_bytes: f.size_bytes,
        generation_time: f.generation_time,
        transmission_start_time: f.transmission_start_time,
        transmission_end_time: f.transmission_end_time,
        status: f.status as any,
        attempt_count: f.attempt_count,
        collision_count: f.collision_count,
      })),
      metrics: record.metrics
        ? {
            simulation_id: record.metrics.simulation_id,
            total_frames_generated: record.metrics.total_frames_generated,
            total_frames_transmitted: record.metrics.total_frames_transmitted,
            total_collisions: record.metrics.total_collisions,
            total_dropped: record.metrics.total_dropped,
            collision_rate: record.metrics.collision_rate,
            throughput_bps: record.metrics.throughput_bps,
            channel_efficiency: record.metrics.channel_efficiency,
            average_latency_us: record.metrics.average_latency_us,
            average_attempts: record.metrics.average_attempts,
            channel_busy_time_us: record.metrics.channel_busy_time_us,
            channel_idle_time_us: record.metrics.channel_idle_time_us,
            channel_collision_time_us: record.metrics.channel_collision_time_us,
            theoretical_efficiency: record.metrics.theoretical_efficiency,
          }
        : null,
    };
  }

  public async findAll(limit: number = 50, offset: number = 0): Promise<SimulationModel[]> {
    const records = await this.prisma.simulation.findMany({
      take: limit,
      skip: offset,
      orderBy: { created_at: 'desc' },
      include: { metrics: true },
    });

    return records.map((record) => ({
      id: record.id,
      name: record.name,
      protocol: record.protocol as any,
      status: record.status as any,
      current_time: record.current_time,
      max_simulation_time: record.max_simulation_time,
      random_seed: record.random_seed,
      config: JSON.parse(record.config),
      created_at: record.created_at,
      updated_at: record.updated_at,
      metrics: record.metrics as any,
    }));
  }

  public async updateState(
    id: string,
    status: string,
    currentTime: number,
    metrics?: SimulationMetricsModel
  ): Promise<void> {
    await this.prisma.simulation.update({
      where: { id },
      data: {
        status,
        current_time: currentTime,
      },
    });

    if (metrics) {
      await this.prisma.simulationMetrics.upsert({
        where: { simulation_id: id },
        create: {
          simulation_id: id,
          total_frames_generated: metrics.total_frames_generated,
          total_frames_transmitted: metrics.total_frames_transmitted,
          total_collisions: metrics.total_collisions,
          total_dropped: metrics.total_dropped,
          collision_rate: metrics.collision_rate,
          throughput_bps: metrics.throughput_bps,
          channel_efficiency: metrics.channel_efficiency,
          average_latency_us: metrics.average_latency_us,
          average_attempts: metrics.average_attempts,
          channel_busy_time_us: metrics.channel_busy_time_us,
          channel_idle_time_us: metrics.channel_idle_time_us,
          channel_collision_time_us: metrics.channel_collision_time_us,
          theoretical_efficiency: metrics.theoretical_efficiency,
        },
        update: {
          total_frames_generated: metrics.total_frames_generated,
          total_frames_transmitted: metrics.total_frames_transmitted,
          total_collisions: metrics.total_collisions,
          total_dropped: metrics.total_dropped,
          collision_rate: metrics.collision_rate,
          throughput_bps: metrics.throughput_bps,
          channel_efficiency: metrics.channel_efficiency,
          average_latency_us: metrics.average_latency_us,
          average_attempts: metrics.average_attempts,
          channel_busy_time_us: metrics.channel_busy_time_us,
          channel_idle_time_us: metrics.channel_idle_time_us,
          channel_collision_time_us: metrics.channel_collision_time_us,
          theoretical_efficiency: metrics.theoretical_efficiency,
        },
      });
    }
  }

  public async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.simulation.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}

