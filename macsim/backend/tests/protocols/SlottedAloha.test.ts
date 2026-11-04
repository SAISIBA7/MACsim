import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine.js';

describe('Slotted ALOHA Simulation Protocol', () => {
  it('should align transmissions to slot boundaries and calculate slot theoretical capacity', () => {
    const slotTimeUs = 1200;
    const engine = new SimulationEngine('test-slotted-1', {
      protocol: 'SLOTTED_ALOHA',
      num_stations: 5,
      simulation_time_us: 100_000,
      arrival_rate_lambda: 40,
      traffic_distribution: 'POISSON',
      frame_size_bytes: 1500,
      channel_bandwidth_bps: 10_000_000,
      propagation_delay_us: 5,
      slot_time_us: slotTimeUs,
      random_seed: 777,
    });

    engine.runUntil(100_000);
    const metrics = engine.getMetrics();

    // Slotted ALOHA theoretical maximum S_max = 1 / e ≈ 0.3679
    expect(metrics.theoretical_efficiency).toBeCloseTo(1 / Math.E, 3);

    // Verify all transmission starts are slot aligned (modulo slotTimeUs == 0)
    for (const event of engine.events) {
      if (event.event_type === 'TRANSMISSION_STARTED') {
        const remainder = event.timestamp % slotTimeUs;
        expect(remainder).toBeCloseTo(0, 1e-3);
      }
    }
  });

  it('should strictly account for mutually exclusive slot states (idle, successful, collided)', () => {
    const slotTimeUs = 1200;
    const engine = new SimulationEngine('test-slotted-slots', {
      protocol: 'SLOTTED_ALOHA',
      num_stations: 4,
      simulation_time_us: 60_000, // 50 slots
      arrival_rate_lambda: 30,
      traffic_distribution: 'POISSON',
      frame_size_bytes: 1500,
      channel_bandwidth_bps: 10_000_000,
      propagation_delay_us: 5,
      slot_time_us: slotTimeUs,
      random_seed: 333,
    });

    engine.runUntil(60_000);
    const metrics = engine.getMetrics();

    expect(metrics.total_slots).toBeDefined();
    expect(metrics.idle_slots).toBeDefined();
    expect(metrics.successful_slots).toBeDefined();
    expect(metrics.collided_slots).toBeDefined();
    expect(metrics.slot_utilization).toBeDefined();

    // Exact invariant: Total slots = Idle slots + Successful slots + Collided slots
    const sum = (metrics.idle_slots ?? 0) + (metrics.successful_slots ?? 0) + (metrics.collided_slots ?? 0);
    expect(sum).toBe(metrics.total_slots);

    // Slot utilization = Successful slots / Total slots
    if (metrics.total_slots! > 0) {
      expect(metrics.slot_utilization).toBeCloseTo(metrics.successful_slots! / metrics.total_slots!, 4);
    }
  });

  it('should handle same-slot collision and slotted backoff correctly', () => {
    const slotTimeUs = 1200;
    const engine = new SimulationEngine('test-slotted-collision', {
      protocol: 'SLOTTED_ALOHA',
      num_stations: 2,
      simulation_time_us: 20_000,
      arrival_rate_lambda: 10,
      traffic_distribution: 'CONSTANT',
      frame_size_bytes: 1500,
      channel_bandwidth_bps: 10_000_000,
      propagation_delay_us: 5,
      slot_time_us: slotTimeUs,
      random_seed: 444,
    });

    engine.eventQueue.clear();
    const station1 = engine.stations.get('station_1')!;
    const station2 = engine.stations.get('station_2')!;

    // Both frames arrive during slot 0 (t = 100 and t = 200).
    // Both must be scheduled for transmission at slot boundary t = 1200.
    engine.clock.advanceTo(100);
    const frame1 = {
      id: 'f_slot_1',
      simulation_id: engine.id,
      frame_id: 1,
      station_id: station1.id,
      size_bytes: 1500,
      generation_time: 100,
      transmission_start_time: null,
      transmission_end_time: null,
      status: 'QUEUED' as const,
      attempt_count: 0,
      collision_count: 0,
    };
    engine.protocol.onFrameGenerated(station1, frame1);

    engine.clock.advanceTo(200);
    const frame2 = {
      id: 'f_slot_2',
      simulation_id: engine.id,
      frame_id: 2,
      station_id: station2.id,
      size_bytes: 1500,
      generation_time: 200,
      transmission_start_time: null,
      transmission_end_time: null,
      status: 'QUEUED' as const,
      attempt_count: 0,
      collision_count: 0,
    };
    engine.protocol.onFrameGenerated(station2, frame2);

    // Advance to end of slot 1 (t = 2400)
    engine.runUntil(2400);

    // Both frames should collide in slot 1 (boundary 1200)
    expect(frame1.collision_count).toBeGreaterThan(0);
    expect(frame2.collision_count).toBeGreaterThan(0);

    // Slot metrics should reflect at least 1 collided slot
    const metrics = engine.getMetrics();
    expect(metrics.collided_slots).toBeGreaterThanOrEqual(1);
  });
});
