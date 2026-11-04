import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('Fastify REST API Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health should return 200 OK', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
  });

  it('GET /api/v1/protocols should return supported protocols', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/protocols',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.protocols).toBeDefined();
    expect(body.protocols.length).toBeGreaterThanOrEqual(4);
    expect(body.trafficModels).toBeDefined();
  });

  it('POST /api/v1/simulations should create a new simulation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/simulations',
      payload: {
        protocol: 'PURE_ALOHA',
        stationCount: 3,
        durationMs: 100,
        trafficIntensity: 0.2,
      },
    });

    expect(res.statusCode).toBe(201);
    const sim = JSON.parse(res.body);
    expect(sim.id).toBeDefined();
    expect(sim.protocol).toBe('PURE_ALOHA');
    expect(sim.stations.length).toBe(3);

    // Test POST /simulations/:id/start
    const startRes = await app.inject({
      method: 'POST',
      url: `/api/v1/simulations/${sim.id}/start?run_to_completion=true`,
    });
    expect(startRes.statusCode).toBe(200);
    const startedSim = JSON.parse(startRes.body);
    expect(startedSim.status).toBe('Completed');
    expect(startedSim.metrics.generatedFrames).toBeGreaterThan(0);

    // Test GET /simulations/:id/results
    const resultsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/simulations/${sim.id}/results`,
    });
    expect(resultsRes.statusCode).toBe(200);

    // Test GET /simulations/:id/events
    const eventsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/simulations/${sim.id}/events`,
    });
    expect(eventsRes.statusCode).toBe(200);
    const events = JSON.parse(eventsRes.body);
    expect(Array.isArray(events)).toBe(true);
  });

  it('POST /api/v1/comparisons/sweep should execute a protocol parameter sweep', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/comparisons/sweep',
      payload: {
        protocols: ['PURE_ALOHA', 'SLOTTED_ALOHA'],
        startLambda: 10,
        endLambda: 50,
        steps: 2,
        simulationTimeUs: 50_000,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBeDefined();
    expect(body.runs.length).toBe(4); // 2 steps * 2 protocols
  });
});
