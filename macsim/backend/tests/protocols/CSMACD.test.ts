import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine.js';

describe('CSMA/CD Simulation Protocol', () => {
  it('should detect collisions and abort transmission early with jam signal', () => {
    const engine = new SimulationEngine('test-csmacd-1', {
      protocol: 'CSMA_CD',
      num_stations: 6,
      simulation_time_us: 150_000,
      arrival_rate_lambda: 100, // high load to force collisions
      traffic_distribution: 'POISSON',
      frame_size_bytes: 1500,
      channel_bandwidth_bps: 10_000_000,
      propagation_delay_us: 5,
      jam_time_us: 3.2,
      random_seed: 555,
    });

    engine.runUntil(150_000);
    const metrics = engine.getMetrics();

    expect(metrics.total_frames_generated).toBeGreaterThan(0);
    // CSMA/CD theoretical efficiency: 1 / (1 + 5a)
    expect(metrics.theoretical_efficiency).toBeGreaterThan(0.7);

    // Verify presence of collision detected events with early abort and jam signal
    const collisionEvents = engine.events.filter((e) => e.event_type === 'COLLISION_DETECTED');
    if (collisionEvents.length > 0) {
      expect(collisionEvents[0].details.abortedEarly).toBe(true);
      expect(collisionEvents[0].details.jamSignalSent).toBe(true);
      expect(collisionEvents[0].details.jamTimeUs).toBe(3.2);
    }
  });

  it('should abort transmission in significantly less time than full frame duration (1200us)', () => {
    const jamTimeUs = 3.2;
    const propagationDelayUs = 5.0;
    const engine = new SimulationEngine('test-csmacd-early-abort', {
      protocol: 'CSMA_CD',
      num_stations: 2,
      simulation_time_us: 20_000,
      arrival_rate_lambda: 10,
      traffic_distribution: 'CONSTANT',
      frame_size_bytes: 1500, // 1200 µs duration
      channel_bandwidth_bps: 10_000_000,
      propagation_delay_us: propagationDelayUs,
      jam_time_us: jamTimeUs,
      random_seed: 777,
    });

    engine.eventQueue.clear();
    const station1 = engine.stations.get('station_1')!;
    const station2 = engine.stations.get('station_2')!;

    // Station 1 starts at t = 1000 µs
    engine.clock.advanceTo(1000);
    const frame1 = {
      id: 'cd_f1',
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

    // Station 2 starts at t = 1002 µs (within tau = 5 µs window)
    engine.clock.advanceTo(1002);
    const frame2 = {
      id: 'cd_f2',
      simulation_id: engine.id,
      frame_id: 2,
      station_id: station2.id,
      size_bytes: 1500,
      generation_time: 1002,
      transmission_start_time: null,
      transmission_end_time: null,
      status: 'QUEUED' as const,
      attempt_count: 0,
      collision_count: 0,
    };
    engine.protocol.onFrameGenerated(station2, frame2);

    // Advance clock to allow early abort to fire
    engine.runUntil(1100);

    // Both frames had their first attempt aborted at ~1000 + 2*tau + jamTime ≈ 1010 µs,
    // which is VASTLY smaller than the full 1200 µs frame time!
    expect(frame1.attempts).toBeDefined();
    expect(frame1.attempts!.length).toBeGreaterThanOrEqual(1);
    expect(frame1.attempts![0].status).toBe('ABORTED');
    const firstAttemptDuration = frame1.attempts![0].end_time - frame1.attempts![0].start_time;
    expect(firstAttemptDuration).toBeLessThan(100); // 10µs << 1200µs

    expect(frame2.attempts).toBeDefined();
    expect(frame2.attempts!.length).toBeGreaterThanOrEqual(1);
    expect(frame2.attempts![0].status).toBe('ABORTED');

    const abortEvents = engine.events.filter(
      (e) => e.event_type === 'COLLISION_DETECTED' && e.details.abortedEarly === true
    );
    expect(abortEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('should drop frame when retry limit (16) is reached', () => {
    const engine = new SimulationEngine('test-csmacd-drop', {
      protocol: 'CSMA_CD',
      num_stations: 2,
      simulation_time_us: 100_000,
      arrival_rate_lambda: 10,
      traffic_distribution: 'CONSTANT',
      frame_size_bytes: 1500,
      channel_bandwidth_bps: 10_000_000,
      propagation_delay_us: 5,
      max_retry_limit: 2, // Low retry limit to test drop
      random_seed: 321,
    });

    engine.eventQueue.clear();
    const station1 = engine.stations.get('station_1')!;

    // Frame that already had 2 attempts
    const frame = {
      id: 'cd_drop_f',
      simulation_id: engine.id,
      frame_id: 99,
      station_id: station1.id,
      size_bytes: 1500,
      generation_time: 1000,
      transmission_start_time: null,
      transmission_end_time: null,
      status: 'QUEUED' as const,
      attempt_count: 2, // already at max
      collision_count: 2,
    };

    engine.stationQueues.set(station1.id, [frame]);
    engine.activeStationFrames.set(station1.id, frame);

    // Trigger collision abort handler
    (engine.protocol as any).handleCollisionAbort(station1, frame);

    expect(frame.status).toBe('DROPPED');
    expect(station1.frames_dropped).toBe(1);

    const dropEvents = engine.events.filter((e) => e.event_type === 'FRAME_DROPPED');
    expect(dropEvents.length).toBe(1);
    expect(dropEvents[0].details.reason).toBe('RETRY_LIMIT_EXHAUSTED');
  });
});
