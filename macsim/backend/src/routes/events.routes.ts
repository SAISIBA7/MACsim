import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { SimulationService } from '../services/SimulationService.js';
import { SSEManager } from '../realtime/SSEManager.js';
import { formatSimulationDetail } from '../utils/formatters.js';

export const eventRoutes: FastifyPluginAsync = async (fastify) => {
  const service = SimulationService.getInstance(fastify.prisma);
  const sseManager = SSEManager.getInstance();

  // GET /simulations/:id/events
  fastify.get('/simulations/:id/events', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = (request.query || {}) as {
      after_sequence?: string;
      since_sequence?: string;
      limit?: string;
    };

    const afterSeq = parseInt(query.after_sequence || query.since_sequence || '0', 10);
    const limit = parseInt(query.limit || '200', 10);

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

    const events = await service.getEvents(id, afterSeq, limit);
    return reply.status(200).send(events);
  });

  // Handler for SSE streaming (supports both /simulations/:id/stream and /simulations/:id/events/stream)
  const handleStream = async (request: any, reply: any) => {
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

    const clientId = randomUUID();

    // Hijack Fastify's response lifecycle to keep connection open for SSE
    reply.hijack();

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders?.();

    const afterSeq = parseInt(request.query?.after_sequence || request.query?.since_sequence || '0', 10);

    // Send immediate snapshot event
    const detail = formatSimulationDetail(sim);
    const snapshotPayload = {
      type: 'snapshot',
      status: detail.status,
      currentSimulationTimeMs: detail.currentSimulationTimeMs,
      stations: detail.stations,
      medium: detail.medium,
      metrics: detail.metrics,
    };

    reply.raw.write(`event: snapshot\ndata: ${JSON.stringify(snapshotPayload)}\n\n`);

    // If client is recovering missing events after sequence N, send them now
    if (afterSeq > 0) {
      try {
        const missedEvents = await service.getEvents(id, afterSeq, 200);
        for (const evt of missedEvents) {
          const seq = evt.sequenceNumber ?? evt.sequence_number;
          const type = evt.eventType ?? evt.event_type;
          reply.raw.write(`id: ${seq}\nevent: ${type}\ndata: ${JSON.stringify(evt)}\n\n`);
        }
      } catch {
        // Safe event recovery
      }
    }

    // Register with SSEManager for future live events
    sseManager.addClient(clientId, id, reply, afterSeq);
  };

  fastify.get('/simulations/:id/stream', handleStream);
  fastify.get('/simulations/:id/events/stream', handleStream);
};
