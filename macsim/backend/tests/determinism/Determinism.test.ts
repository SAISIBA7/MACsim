import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine.js';

describe('Simulation Determinism', () => {
  it('should generate bit-identical trajectories for CSMA/CD given identical random seeds', () => {
    const config = {
      protocol: 'CSMA_CD' as const,
      num_stations: 4,
      simulation_time_us: 100_000,
      arrival_rate_lambda: 60,
      traffic_distribution: 'POISSON' as const,
      frame_size_bytes: 1500,
      channel_bandwidth_bps: 10_000_000,
      propagation_delay_us: 5,
      random_seed: 8888,
    };

    const engine1 = new SimulationEngine('sim-det-1', config);
    const engine2 = new SimulationEngine('sim-det-2', config);

    engine1.runUntil(100_000);
    engine2.runUntil(100_000);

    const metrics1 = engine1.getMetrics();
    const metrics2 = engine2.getMetrics();

    expect(metrics1.total_frames_generated).toBe(metrics2.total_frames_generated);
    expect(metrics1.total_frames_transmitted).toBe(metrics2.total_frames_transmitted);
    expect(metrics1.total_collisions).toBe(metrics2.total_collisions);
    expect(metrics1.throughput_bps).toBe(metrics2.throughput_bps);
    expect(engine1.events.length).toBe(engine2.events.length);

    for (let i = 0; i < engine1.events.length; i++) {
      expect(engine1.events[i].timestamp).toBe(engine2.events[i].timestamp);
      expect(engine1.events[i].event_type).toBe(engine2.events[i].event_type);
    }
  });

  it('should generate bit-identical trajectories for Slotted ALOHA given identical random seeds', () => {
    const config = {
      protocol: 'SLOTTED_ALOHA' as const,
      num_stations: 4,
      simulation_time_us: 100_000,
      arrival_rate_lambda: 50,
      traffic_distribution: 'POISSON' as const,
      frame_size_bytes: 1500,
      channel_bandwidth_bps: 10_000_000,
      propagation_delay_us: 5,
      slot_time_us: 1200,
      random_seed: 9999,
    };

    const engine1 = new SimulationEngine('sim-det-slotted-1', config);
    const engine2 = new SimulationEngine('sim-det-slotted-2', config);

    engine1.runUntil(100_000);
    engine2.runUntil(100_000);

    const metrics1 = engine1.getMetrics();
    const metrics2 = engine2.getMetrics();

    expect(metrics1.total_frames_generated).toBe(metrics2.total_frames_generated);
    expect(metrics1.total_frames_transmitted).toBe(metrics2.total_frames_transmitted);
    expect(metrics1.total_slots).toBe(metrics2.total_slots);
    expect(metrics1.successful_slots).toBe(metrics2.successful_slots);
    expect(metrics1.collided_slots).toBe(metrics2.collided_slots);
    expect(metrics1.idle_slots).toBe(metrics2.idle_slots);
    expect(engine1.events.length).toBe(engine2.events.length);
  });
});
