import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine.js';

describe('Pure ALOHA Simulation Protocol', () => {
  it('should simulate Pure ALOHA and calculate accurate theoretical capacity', () => {
    const engine = new SimulationEngine('test-aloha-1', {
      protocol: 'PURE_ALOHA',
      num_stations: 4,
      simulation_time_us: 100_000, // 100ms
      arrival_rate_lambda: 50,
      traffic_distribution: 'POISSON',
      frame_size_bytes: 1500,
      channel_bandwidth_bps: 10_000_000,
      propagation_delay_us: 5,
      random_seed: 42,
    });

    engine.runUntil(100_000);
    const metrics = engine.getMetrics();

    expect(metrics.total_frames_generated).toBeGreaterThan(0);
    expect(metrics.total_frames_transmitted).toBeGreaterThanOrEqual(0);
    // Pure ALOHA theoretical peak S_max = 1 / (2e) ≈ 0.1839
    expect(metrics.theoretical_efficiency).toBeCloseTo(1 / (2 * Math.E), 3);
  });

  it('should detect collisions during the 2*T_f vulnerable period', () => {
    // 1500 bytes at 10 Mbps = (1500 * 8) / 10 = 1200 µs
    const engine = new SimulationEngine('test-aloha-vulnerable', {
      protocol: 'PURE_ALOHA',
      num_stations: 2,
      simulation_time_us: 50_000,
      arrival_rate_lambda: 10,
      traffic_distribution: 'CONSTANT',
      frame_size_bytes: 1500,
      channel_bandwidth_bps: 10_000_000,
      propagation_delay_us: 5,
      random_seed: 101,
    });

    // Clear auto-scheduled arrivals to manually inject transmissions within vulnerable period
    engine.eventQueue.clear();

    const station1 = engine.stations.get('station_1')!;
    const station2 = engine.stations.get('station_2')!;

    // Station 1 transmits at t = 1000 µs (runs to 2200 µs)
    engine.clock.advanceTo(1000);
    const frame1 = {
      id: 'f1',
      simulation_id: engine.id,
      frame_id: 1,
      station_id: station1.id,
      size_bytes: 1500,
      generation_time: 1000,
      transmission_start_time: null,
      transmission_end_time: null,
      status: 'QUEUED' as const,
      attempt_count: 0,
      collision_count: 0,
    };
    engine.protocol.onFrameGenerated(station1, frame1);

    // Station 2 transmits at t = 1500 µs (inside vulnerable window [1000, 2200])
    engine.clock.advanceTo(1500);
    const frame2 = {
      id: 'f2',
      simulation_id: engine.id,
      frame_id: 2,
      station_id: station2.id,
      size_bytes: 1500,
      generation_time: 1500,
      transmission_start_time: null,
      transmission_end_time: null,
      status: 'QUEUED' as const,
      attempt_count: 0,
      collision_count: 0,
    };
    engine.protocol.onFrameGenerated(station2, frame2);

    // Run until both complete
    engine.runUntil(5000);

    // Both frames should have collided
    expect(frame1.collision_count).toBeGreaterThan(0);
    expect(frame2.collision_count).toBeGreaterThan(0);
  });

  it('should deliver frame without collision when transmission is outside vulnerable period', () => {
    const engine = new SimulationEngine('test-aloha-clean', {
      protocol: 'PURE_ALOHA',
      num_stations: 2,
      simulation_time_us: 50_000,
      arrival_rate_lambda: 10,
      traffic_distribution: 'CONSTANT',
      frame_size_bytes: 1500,
      channel_bandwidth_bps: 10_000_000,
      propagation_delay_us: 5,
      random_seed: 202,
    });

    engine.eventQueue.clear();
    const station1 = engine.stations.get('station_1')!;
    const station2 = engine.stations.get('station_2')!;

    // Station 1 transmits at t = 1000 µs (finishes at 2200 µs)
    engine.clock.advanceTo(1000);
    const frame1 = {
      id: 'f1',
      simulation_id: engine.id,
      frame_id: 1,
      station_id: station1.id,
      size_bytes: 1500,
      generation_time: 1000,
      transmission_start_time: null,
      transmission_end_time: null,
      status: 'QUEUED' as const,
      attempt_count: 0,
      collision_count: 0,
    };
    engine.protocol.onFrameGenerated(station1, frame1);

    // Run until station 1 finishes cleanly
    engine.runUntil(2500);
    expect(frame1.status).toBe('SUCCESSFUL');
    expect(frame1.collision_count).toBe(0);

    // Station 2 transmits well after station 1 finished (at t = 3000 µs)
    engine.clock.advanceTo(3000);
    const frame2 = {
      id: 'f2',
      simulation_id: engine.id,
      frame_id: 2,
      station_id: station2.id,
      size_bytes: 1500,
      generation_time: 3000,
      transmission_start_time: null,
      transmission_end_time: null,
      status: 'QUEUED' as const,
      attempt_count: 0,
      collision_count: 0,
    };
    engine.protocol.onFrameGenerated(station2, frame2);

    engine.runUntil(5000);
    expect(frame2.status).toBe('SUCCESSFUL');
    expect(frame2.collision_count).toBe(0);
  });
});
