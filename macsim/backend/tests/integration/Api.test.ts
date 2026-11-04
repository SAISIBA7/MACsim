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

  it('Controls: should step, pause, resume, and reset a simulation session', async () => {
    // 1. Create session
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/simulations',
      payload: {
        protocol: 'CSMA_CD',
        stationCount: 4,
        durationMs: 500,
        trafficIntensity: 0.5,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const sim = JSON.parse(createRes.body);
    expect(sim.status).toBe('Ready');

    // 2. Step session
    const stepRes = await app.inject({
      method: 'POST',
      url: `/api/v1/simulations/${sim.id}/step`,
      payload: { step_count: 5 },
    });
    expect(stepRes.statusCode).toBe(200);

    // 3. Pause session
    const pauseRes = await app.inject({
      method: 'POST',
      url: `/api/v1/simulations/${sim.id}/pause`,
    });
    expect(pauseRes.statusCode).toBe(200);
    expect(JSON.parse(pauseRes.body).status).toBe('Paused');

    // 4. Resume session
    const resumeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/simulations/${sim.id}/resume`,
    });
    expect(resumeRes.statusCode).toBe(200);

    // 5. Reset session
    const resetRes = await app.inject({
      method: 'POST',
      url: `/api/v1/simulations/${sim.id}/reset`,
    });
    expect(resetRes.statusCode).toBe(200);
    expect(JSON.parse(resetRes.body).status).toBe('Ready');
  });

  it('Protocols: should support all 4 core MAC protocols in creation and execution', async () => {
    const protocols = ['PURE_ALOHA', 'SLOTTED_ALOHA', 'CSMA', 'CSMA_CD'];

    for (const proto of protocols) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/simulations',
        payload: {
          protocol: proto,
          stationCount: 3,
          durationMs: 50,
          trafficIntensity: 0.3,
        },
      });

      expect(res.statusCode).toBe(201);
      const created = JSON.parse(res.body);
      expect(created.protocol).toBe(proto);

      // Run to completion
      const startRes = await app.inject({
        method: 'POST',
        url: `/api/v1/simulations/${created.id}/start?run_to_completion=true`,
      });
      expect(startRes.statusCode).toBe(200);
      const completed = JSON.parse(startRes.body);
      expect(completed.status).toBe('Completed');
    }
  });

  it('GET /api/v1/simulations should return persistent simulation history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/simulations?limit=10',
    });
    expect(res.statusCode).toBe(200);
    const list = JSON.parse(res.body);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });
});
