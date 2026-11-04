import { FastifyPluginAsync } from 'fastify';
import { SimulationService } from '../services/SimulationService.js';
import { normalizeConfig, formatSimulationDetail } from '../utils/formatters.js';

export const simulationRoutes: FastifyPluginAsync = async (fastify) => {
  const service = SimulationService.getInstance(fastify.prisma);

  // POST /simulations
  fastify.post('/simulations', async (request, reply) => {
    const rawConfig = request.body || {};
    const normConfig = normalizeConfig(rawConfig);
    const sim = await service.createSimulation(normConfig);
    const detail = formatSimulationDetail(sim);
    return reply.status(201).send(detail);
  });

  // GET /simulations
  fastify.get('/simulations', async (request, reply) => {
    const query = (request.query || {}) as { skip?: string; limit?: string; protocol?: string };
    const limit = parseInt(query.limit || '50', 10);
    const skip = parseInt(query.skip || '0', 10);

    const list = await service.listSimulations(limit, skip);
    const formatted = list.map((sim) => {
      const detail = formatSimulationDetail(sim);
      return {
        id: detail.id,
        protocol: detail.protocol,
        status: detail.status,
        configuration: detail.configuration,
        createdAt: detail.createdAt,
        metrics: detail.metrics,
      };
    });

    return reply.status(200).send(formatted);
  });

  // GET /simulations/:id
  fastify.get('/simulations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const sim = await service.getSimulation(id);

    if (!sim) {
      return reply.status(404).send({
        error: {
          code: 'SIMULATION_NOT_FOUND',
          message: `Simulation ${id} not found`,
        },
        statusCode: 404,
        message: `Simulation ${id} not found`,
      });
    }

    const detail = formatSimulationDetail(sim);
    return reply.status(200).send(detail);
  });

  // GET /simulations/:id/results
  fastify.get('/simulations/:id/results', async (request, reply) => {
    const { id } = request.params as { id: string };
    const sim = await service.getSimulation(id);

    if (!sim) {
      return reply.status(404).send({
        error: {
          code: 'SIMULATION_NOT_FOUND',
          message: `Simulation ${id} not found`,
        },
        statusCode: 404,
        message: `Simulation ${id} not found`,
      });
    }

    const detail = formatSimulationDetail(sim);
    return reply.status(200).send({
      simulationId: id,
      protocol: detail.protocol,
      metrics: detail.metrics,
      status: detail.status,
      elapsedMs: detail.currentSimulationTimeMs,
      stationStats: detail.stations,
    });
  });

  // DELETE /simulations/:id
  fastify.delete('/simulations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await service.deleteSimulation(id);

    if (!deleted) {
      return reply.status(404).send({
        error: {
          code: 'SIMULATION_NOT_FOUND',
          message: `Simulation ${id} not found`,
        },
        statusCode: 404,
        message: `Simulation ${id} not found`,
      });
    }

    return reply.status(200).send({ message: 'Simulation deleted' });
  });

  // DELETE /simulations (Clear all simulations)
  fastify.delete('/simulations', async (_request, reply) => {
    await fastify.prisma.simulation.deleteMany({});
    return reply.status(200).send({ message: 'All simulations cleared' });
  });

  // GET /simulations/:id/stations
  fastify.get('/simulations/:id/stations', async (request, reply) => {
    const { id } = request.params as { id: string };
    const sim = await service.getSimulation(id);

    if (!sim) {
      return reply.status(404).send({
        error: {
          code: 'SIMULATION_NOT_FOUND',
          message: `Simulation ${id} not found`,
        },
        statusCode: 404,
        message: `Simulation ${id} not found`,
      });
    }

    const detail = formatSimulationDetail(sim);
    return reply.status(200).send(detail.stations);
  });
};
