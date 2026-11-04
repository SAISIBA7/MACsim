import { z } from 'zod';
import { PROTOCOL_TYPES, DEFAULTS } from '../config/constants.js';

export const StationConfigSchema = z.object({
  station_index: z.number().int().min(0),
  traffic_rate_multiplier: z.number().positive().default(1.0),
  frame_size_bytes: z.number().int().positive().optional(),
});

export const SimulationConfigSchema = z.object({
  protocol: z.enum([
    PROTOCOL_TYPES.PURE_ALOHA,
    PROTOCOL_TYPES.SLOTTED_ALOHA,
    PROTOCOL_TYPES.CSMA_1_PERSISTENT,
    PROTOCOL_TYPES.CSMA_NON_PERSISTENT,
    PROTOCOL_TYPES.CSMA_P_PERSISTENT,
    PROTOCOL_TYPES.CSMA_CD,
  ]),
  num_stations: z.number().int().min(1).max(100).default(5),
  simulation_time_us: z.number().positive().default(DEFAULTS.MAX_SIMULATION_TIME_US),
  arrival_rate_lambda: z.number().positive().default(100.0), // frames per second per station
  traffic_distribution: z.enum(['POISSON', 'UNIFORM', 'BURST', 'CONSTANT']).default('POISSON'),
  frame_size_bytes: z.number().int().positive().default(DEFAULTS.FRAME_SIZE_BYTES),
  channel_bandwidth_bps: z.number().positive().default(DEFAULTS.BANDWIDTH_BPS),
  propagation_delay_us: z.number().min(0).default(DEFAULTS.PROPAGATION_DELAY_US),
  slot_time_us: z.number().positive().optional(),
  p_persistence: z.number().min(0.01).max(1.0).optional().default(0.5),
  jam_time_us: z.number().positive().optional().default(DEFAULTS.JAM_SIGNAL_TIME_US),
  max_retry_limit: z.number().int().min(1).max(32).optional().default(DEFAULTS.MAX_RETRY_COUNT),
  random_seed: z.number().int().optional(),
  name: z.string().optional(),
  station_configs: z.array(StationConfigSchema).optional(),
});

export type SimulationConfigInput = z.infer<typeof SimulationConfigSchema>;

