import { FastifyPluginAsync } from 'fastify';
import { SimulationService } from '../services/SimulationService.js';
import { formatSimulationDetail } from '../utils/formatters.js';

export const controlRoutes: FastifyPluginAsync = async (fastify) => {
  const service = SimulationService.getInstance(fastify.prisma);

  // POST /simulations/:id/start
  fastify.post('/simulations/:id/start', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = (request.query || {}) as { run_to_completion?: string; runToCompletion?: string };
    const body = (request.body || {}) as { runToCompletion?: boolean; run_to_completion?: boolean };
    const runToCompletion =
      query.run_to_completion === 'true' ||
      query.runToCompletion === 'true' ||
      body.runToCompletion === true ||
      body.run_to_completion === true;

    try {
      const sim = await service.startSimulation(id, runToCompletion);
      return reply.status(200).send(formatSimulationDetail(sim));
    } catch (err: any) {
      const isNotFound = err.message?.toLowerCase().includes('not found');
      const statusCode = isNotFound ? 404 : 400;
      return reply.status(statusCode).send({
        error: {
          code: isNotFound ? 'SIMULATION_NOT_FOUND' : 'CONTROL_ERROR',
          message: err.message || 'Failed to start simulation',
        },
        message: err.message || 'Failed to start simulation',
        statusCode,
      });
    }
  });

  // POST /simulations/:id/pause
  fastify.post('/simulations/:id/pause', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const sim = await service.pauseSimulation(id);
      return reply.status(200).send(formatSimulationDetail(sim));
    } catch (err: any) {
      const isNotFound = err.message?.toLowerCase().includes('not found');
      const statusCode = isNotFound ? 404 : 400;
      return reply.status(statusCode).send({
        error: {
          code: isNotFound ? 'SIMULATION_NOT_FOUND' : 'CONTROL_ERROR',
          message: err.message || 'Failed to pause simulation',
        },
        message: err.message || 'Failed to pause simulation',
        statusCode,
      });
    }
  });

  // POST /simulations/:id/resume
  fastify.post('/simulations/:id/resume', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const sim = await service.resumeSimulation(id);
      return reply.status(200).send(formatSimulationDetail(sim));
    } catch (err: any) {
      const isNotFound = err.message?.toLowerCase().includes('not found');
      const statusCode = isNotFound ? 404 : 400;
      return reply.status(statusCode).send({
        error: {
          code: isNotFound ? 'SIMULATION_NOT_FOUND' : 'CONTROL_ERROR',
          message: err.message || 'Failed to resume simulation',
        },
        message: err.message || 'Failed to resume simulation',
        statusCode,
      });
    }
  });

  // POST /simulations/:id/step
  fastify.post('/simulations/:id/step', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { step_count?: number; delta_time_us?: number };
    const stepCount = body.step_count ?? 1;
    const deltaUs = body.delta_time_us;

    try {
      const sim = await service.stepSimulation(id, stepCount, deltaUs);
      return reply.status(200).send(formatSimulationDetail(sim));
    } catch (err: any) {
      const isNotFound = err.message?.toLowerCase().includes('not found');
      const statusCode = isNotFound ? 404 : 400;
      return reply.status(statusCode).send({
        error: {
          code: isNotFound ? 'SIMULATION_NOT_FOUND' : 'CONTROL_ERROR',
          message: err.message || 'Failed to step simulation',
        },
        message: err.message || 'Failed to step simulation',
        statusCode,
      });
    }
  });

  // POST /simulations/:id/reset
  fastify.post('/simulations/:id/reset', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const sim = await service.resetSimulation(id);
      return reply.status(200).send(formatSimulationDetail(sim));
    } catch (err: any) {
      const isNotFound = err.message?.toLowerCase().includes('not found');
      const statusCode = isNotFound ? 404 : 400;
      return reply.status(statusCode).send({
        error: {
          code: isNotFound ? 'SIMULATION_NOT_FOUND' : 'CONTROL_ERROR',
          message: err.message || 'Failed to reset simulation',
        },
        message: err.message || 'Failed to reset simulation',
        statusCode,
      });
    }
  });

  // POST /simulations/:id/speed
  fastify.post('/simulations/:id/speed', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { speed: number };
    const speed = body.speed || 1.0;
    service.setPlaybackSpeed(id, speed);
    return reply.status(200).send({
      simulationId: id,
      playbackSpeed: speed,
    });
  });
};
