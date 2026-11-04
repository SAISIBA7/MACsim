import { z } from 'zod';

export const StationResponseSchema = z.object({
  id: z.string(),
  simulation_id: z.string(),
  station_index: z.number(),
  name: z.string(),
  state: z.string(),
  frames_generated: z.number(),
  frames_transmitted: z.number(),
  frames_collided: z.number(),
  frames_dropped: z.number(),
  backoff_count: z.number(),
  current_backoff_window: z.number(),
  next_attempt_time: z.number().nullable(),
  queue_length: z.number(),
});

export const FrameResponseSchema = z.object({
  id: z.string(),
  simulation_id: z.string(),
  frame_id: z.number(),
  station_id: z.string(),
  size_bytes: z.number(),
  generation_time: z.number(),
  transmission_start_time: z.number().nullable(),
  transmission_end_time: z.number().nullable(),
  status: z.string(),
  attempt_count: z.number(),
  collision_count: z.number(),
});

export const EventResponseSchema = z.object({
  id: z.string(),
  simulation_id: z.string(),
  sequence_number: z.number(),
  timestamp: z.number(),
  event_type: z.string(),
  station_id: z.string().nullable(),
  frame_id: z.string().nullable(),
  details: z.record(z.any()),
});

export const MetricsResponseSchema = z.object({
  id: z.string().optional(),
  simulation_id: z.string(),
  total_frames_generated: z.number(),
  total_frames_transmitted: z.number(),
  total_collisions: z.number(),
  total_dropped: z.number(),
  collision_rate: z.number(),
  throughput_bps: z.number(),
  channel_efficiency: z.number(),
  average_latency_us: z.number(),
  average_attempts: z.number(),
  channel_busy_time_us: z.number(),
  channel_idle_time_us: z.number(),
  channel_collision_time_us: z.number(),
  theoretical_efficiency: z.number().nullable(),
});

export const ComparisonCreateSchema = z.object({
  name: z.string().optional(),
  simulation_ids: z.array(z.string()).min(2),
});

export const SweepComparisonRequestSchema = z.object({
  protocols: z.array(z.string()).min(1),
  load_range: z.object({
    start_lambda: z.number().positive(),
    end_lambda: z.number().positive(),
    steps: z.number().int().min(2).max(20).default(5),
  }),
  num_stations: z.number().int().min(2).max(50).default(5),
  simulation_time_us: z.number().positive().default(500000.0),
  frame_size_bytes: z.number().int().positive().default(1500),
  bandwidth_bps: z.number().positive().default(10000000),
});

