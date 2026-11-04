import { PrismaClient } from '@prisma/client';

export interface ComparisonRunData {
  simulation_id: string;
  protocol: string;
  offered_load: number;
  throughput_bps: number;
  channel_efficiency: number;
  collision_rate: number;
  average_latency_us: number;
}

export class ComparisonRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  public async create(
    id: string,
    name?: string,
    runs: ComparisonRunData[] = []
  ): Promise<any> {
    return this.prisma.comparison.create({
      data: {
        id,
        name: name ?? null,
        runs: {
          create: runs.map((r) => ({
            simulation_id: r.simulation_id,
            protocol: r.protocol,
            offered_load: r.offered_load,
            throughput_bps: r.throughput_bps,
            channel_efficiency: r.channel_efficiency,
            collision_rate: r.collision_rate,
            average_latency_us: r.average_latency_us,
          })),
        },
      },
      include: { runs: true },
    });
  }

  public async findById(id: string): Promise<any> {
    return this.prisma.comparison.findUnique({
      where: { id },
      include: { runs: true },
    });
  }

  public async findAll(limit: number = 20): Promise<any[]> {
    return this.prisma.comparison.findMany({
      take: limit,
      orderBy: { created_at: 'desc' },
      include: { runs: true },
    });
  }
}

