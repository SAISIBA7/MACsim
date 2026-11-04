import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { ComparisonService } from '../services/ComparisonService.js';
import { SimulationService } from '../services/SimulationService.js';
import { formatSimulationDetail } from '../utils/formatters.js';

export const comparisonRoutes: FastifyPluginAsync = async (fastify) => {
  const compService = ComparisonService.getInstance(fastify.prisma);
  const simService = SimulationService.getInstance(fastify.prisma);

  // POST /comparisons
  fastify.post('/comparisons', async (request, reply) => {
    const body = (request.body || {}) as {
      simulationIds?: string[];
      notes?: string;
      name?: string;
    };

    const simIds = body.simulationIds || [];
    const runs: any[] = [];

    for (const simId of simIds) {
      const sim = await simService.getSimulation(simId);
      if (sim) {
        const detail = formatSimulationDetail(sim);
        runs.push({
          id: simId,
          protocol: detail.protocol,
          configuration: detail.configuration,
          metrics: detail.metrics,
        });
      }
    }

    const comparisonId = randomUUID();
    const createdAt = new Date().toISOString();

    const response = {
      id: comparisonId,
      createdAt,
      isComparable: runs.length >= 2,
      notes: body.notes || 'Protocol comparison report',
      commonConditions: {
        totalSimulations: runs.length,
      },
      differences: {},
      warnings: runs.length < 2 ? ['At least two runs are required for comprehensive comparison'] : [],
      runs,
    };

    return reply.status(201).send(response);
  });

  // POST /comparisons/sweep
  fastify.post('/comparisons/sweep', async (request, reply) => {
    const body = (request.body || {}) as any;
    const protocols = body.protocols || ['PURE_ALOHA', 'SLOTTED_ALOHA', 'CSMA', 'CSMA_CD'];
    const startLambda = body.load_range?.start_lambda ?? body.startLambda ?? 10;
    const endLambda = body.load_range?.end_lambda ?? body.endLambda ?? 200;
    const steps = body.load_range?.steps ?? body.steps ?? 6;

    const result = await compService.runSweep({
      name: body.name,
      protocols,
      startLambda,
      endLambda,
      steps,
      numStations: body.num_stations ?? body.stationCount ?? 5,
      simulationTimeUs: body.simulation_time_us ?? 500_000,
      frameSizeBytes: body.frame_size_bytes ?? 1500,
      bandwidthBps: body.bandwidth_bps ?? 10_000_000,
    });

    return reply.status(201).send(result);
  });

  // GET /comparisons
  fastify.get('/comparisons', async (_request, reply) => {
    const list = await compService.listComparisons();
    const formatted = list.map((c) => ({
      id: c.id,
      createdAt: c.created_at?.toISOString() || new Date().toISOString(),
      isComparable: true,
      notes: c.name || '',
      commonConditions: {},
      differences: {},
      warnings: [],
      runs: c.runs.map((r: any) => ({
        id: r.simulation_id,
        protocol: r.protocol,
        configuration: { protocol: r.protocol },
        metrics: {
          successfulFrames: 0,
          collisions: 0,
          retransmissions: 0,
          throughputBps: r.throughput_bps,
          channelUtilization: r.channel_efficiency,
          elapsedMs: 500,
        },
      })),
    }));

    return reply.status(200).send(formatted);
  });

  // GET /comparisons/:id
  fastify.get('/comparisons/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const comp = await compService.getComparison(id);

    if (!comp) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Comparison ${id} not found`,
      });
    }

    return reply.status(200).send(comp);
  });
};

