import { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      engineVersion: env.ENGINE_VERSION,
      environment: env.ENVIRONMENT,
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });
};

