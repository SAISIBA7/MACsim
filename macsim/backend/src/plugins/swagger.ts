import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'MACSim API Documentation',
        description:
          'Medium Access Control Protocol Simulator REST APIs and Real-Time Event Streaming',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://127.0.0.1:8000',
          description: 'Local development server',
        },
      ],
      tags: [
        { name: 'Protocols', description: 'Available MAC protocol definitions and parameters' },
        { name: 'Simulations', description: 'Simulation session lifecycle and configurations' },
        { name: 'Controls', description: 'Execution controls: start, pause, resume, step, reset' },
        { name: 'Events', description: 'Simulation event log and real-time SSE stream' },
        { name: 'Metrics', description: 'Throughput, collision rates, and efficiency metrics' },
        { name: 'Comparisons', description: 'Comparative protocol performance benchmarks' },
        { name: 'Health', description: 'System health check' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
};

export default fp(swaggerPlugin);

