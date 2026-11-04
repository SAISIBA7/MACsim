import Fastify, { FastifyInstance } from 'fastify';
import prismaPlugin from './plugins/prisma.js';
import corsPlugin from './plugins/cors.js';
import swaggerPlugin from './plugins/swagger.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import { apiRoutes } from './routes/index.js';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
      transport:
        process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Handle all bodies (JSON, text, or empty) cleanly
  fastify.removeAllContentTypeParsers();
  fastify.addContentTypeParser('*', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (typeof body === 'string' && body.trim() === '')) {
      done(null, {});
      return;
    }
    try {
      const json = JSON.parse(body as string);
      done(null, json);
    } catch {
      done(null, {});
    }
  });

  // Register core plugins
  await fastify.register(prismaPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(swaggerPlugin);
  await fastify.register(errorHandlerPlugin);

  // Register API routes under /api/v1
  await fastify.register(apiRoutes, { prefix: '/api/v1' });

  // Also register under /api for convenience
  await fastify.register(apiRoutes, { prefix: '/api' });

  return fastify;
}
