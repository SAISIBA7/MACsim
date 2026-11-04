import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine.js';

describe('CSMA Simulation Protocol', () => {
  it('should accept unified CSMA protocol identifier and calculate metrics', () => {
    const engine = new SimulationEngine('test-csma-unified', {
      protocol: 'CSMA',
      num_stations: 3,
      simulation_time_us: 100_000,
      arrival_rate_lambda: 30,
      traffic_distribution: 'POISSON',
      frame_size_bytes: 1500,
      channel_bandwidth_bps: 10_000_000,
      propagation_delay_us: 5,
      random_seed: 123,
    });

    engine.runUntil(100_000);
    const metrics = engine.getMetrics();

    expect(metrics.total_frames_generated).toBeGreaterThan(0);
    // Carrier sensing events should be recorded
    const senseEvents = engine.events.filter(
      (e) => e.event_type === 'CARRIER_SENSED_IDLE' || e.event_type === 'CARRIER_SENSED_BUSY'
    );
    expect(senseEvents.length).toBeGreaterThan(0);
    expect(metrics.theoretical_efficiency).toBeGreaterThan(0.5);
  });

  it('should sense channel IDLE and transmit immediately when channel is empty', () => {
    const engine = new SimulationEngine('test-csma-idle-sense', {
      protocol: 'CSMA',
      num_stations: 2,
      simulation_time_us: 20_000,
      arrival_rate_lambda: 10,
      traffic_distribution: 'CONSTANT',
      frame_size_bytes: 1500,
      channel_bandwidth_bps: 10_000_000,
      propagation_delay_us: 5,
      random_seed: 999,
    });

    engine.eventQueue.clear();
    const station1 = engine.stations.get('station_1')!;

    engine.clock.advanceTo(1000);
    const frame1 = {
      id: 'csma_f1',
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

    // Station should immediately sense idle and start transmitting
    expect(station1.state).toBe('TRANSMITTING');
    expect(frame1.status).toBe('TRANSMITTING');
    expect(frame1.transmission_start_time).toBe(1000);

    // Let it run to completion (1000 + 1200 = 2200 µs)
    engine.runUntil(2500);
    expect(frame1.status).toBe('SUCCESSFUL');
  });

  it('should sense channel BUSY and defer when medium is occupied after propagation delay tau', () => {
    const propagationDelayUs = 10;
    const engine = new SimulationEngine('test-csma-busy-defer', {
      protocol: 'CSMA',
      num_stations: 2,
      simulation_time_us: 20_000,
      arrival_rate_lambda: 10,
      traffic_distribution: 'CONSTANT',
      frame_size_bytes: 1500,
      channel_bandwidth_bps: 10_000_000,
      propagation_delay_us: propagationDelayUs,
      random_seed: 888,
    });

    engine.eventQueue.clear();
    const station1 = engine.stations.get('station_1')!;
    const station2 = engine.stations.get('station_2')!;

    // Station 1 starts transmitting at t = 1000 µs (runs to 2200 µs)
    engine.clock.advanceTo(1000);
    const frame1 = {
      id: 'csma_f1',
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

    // At t = 1020 µs (which is > 1000 + tau = 1010), Station 2 generates a frame
    engine.clock.advanceTo(1020);
    const frame2 = {
      id: 'csma_f2',
      simulation_id: engine.id,
      frame_id: 2,
      station_id: station2.id,
      size_bytes: 1500,
      generation_time: 1020,
      transmission_start_time: null,
      transmission_end_time: null,
      status: 'QUEUED' as const,
      attempt_count: 0,
      collision_count: 0,
    };
    engine.protocol.onFrameGenerated(station2, frame2);

    // Station 2 must sense BUSY and NOT transmit simultaneously
    const busyEvents = engine.events.filter(
      (e) => e.event_type === 'CARRIER_SENSED_BUSY' && e.station_id === station2.id
    );
    expect(busyEvents.length).toBeGreaterThan(0);
    expect(station2.state).not.toBe('TRANSMITTING');

    // Run until everything completes
    engine.runUntil(10_000);
    expect(frame1.status).toBe('SUCCESSFUL');
    expect(frame2.status).toBe('SUCCESSFUL');
  });

  it('should experience collision when second station transmits during propagation delay window tau', () => {
    const propagationDelayUs = 20;
    const engine = new SimulationEngine('test-csma-tau-collision', {
      protocol: 'CSMA',
      num_stations: 2,
      simulation_time_us: 20_000,
      arrival_rate_lambda: 10,
      traffic_distribution: 'CONSTANT',
      frame_size_bytes: 1500,
      channel_bandwidth_bps: 10_000_000,
      propagation_delay_us: propagationDelayUs,
      random_seed: 777,
    });

    engine.eventQueue.clear();
    const station1 = engine.stations.get('station_1')!;
    const station2 = engine.stations.get('station_2')!;

    // Station 1 starts at t = 1000 µs
    engine.clock.advanceTo(1000);
    const frame1 = {
      id: 'csma_f1',
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

    // Station 2 generates frame at t = 1010 µs (< 1000 + tau = 1020 µs)
    // At t = 1010, station 1's signal has NOT reached station 2 yet!
    // Station 2 senses IDLE and starts transmitting!
    engine.clock.advanceTo(1010);
    const frame2 = {
      id: 'csma_f2',
      simulation_id: engine.id,
      frame_id: 2,
      station_id: station2.id,
      size_bytes: 1500,
      generation_time: 1010,
      transmission_start_time: null,
      transmission_end_time: null,
      status: 'QUEUED' as const,
      attempt_count: 0,
      collision_count: 0,
    };
    engine.protocol.onFrameGenerated(station2, frame2);

    // In ordinary CSMA (no CD), both transmissions run to completion then report collision
    engine.runUntil(5000);

    expect(frame1.collision_count).toBeGreaterThan(0);
    expect(frame2.collision_count).toBeGreaterThan(0);
  });
});
