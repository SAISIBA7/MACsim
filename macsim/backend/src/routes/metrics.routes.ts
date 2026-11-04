import { FastifyPluginAsync } from 'fastify';
import { SimulationService } from '../services/SimulationService.js';

export const metricRoutes: FastifyPluginAsync = async (fastify) => {
  const service = SimulationService.getInstance(fastify.prisma);

  fastify.get('/simulations/:id/metrics', async (request, reply) => {
    const { id } = request.params as { id: string };
    const metrics = await service.getMetrics(id);

    if (!metrics) {
      return reply.status(404).send({
        error: {
          code: 'SIMULATION_NOT_FOUND',
          message: `Metrics for simulation ${id} not found`,
        },
        statusCode: 404,
        message: `Metrics for simulation ${id} not found`,
      });
    }

    return reply.status(200).send(metrics);
  });
};
