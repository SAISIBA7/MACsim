import { FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.routes.js';
import { protocolRoutes } from './protocols.routes.js';
import { simulationRoutes } from './simulations.routes.js';
import { controlRoutes } from './controls.routes.js';
import { eventRoutes } from './events.routes.js';
import { metricRoutes } from './metrics.routes.js';
import { comparisonRoutes } from './comparisons.routes.js';

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes);
  await fastify.register(protocolRoutes);
  await fastify.register(simulationRoutes);
  await fastify.register(controlRoutes);
  await fastify.register(eventRoutes);
  await fastify.register(metricRoutes);
  await fastify.register(comparisonRoutes);
};

