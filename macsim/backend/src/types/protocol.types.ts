import { ProtocolType } from '../config/constants.js';

export type TrafficDistribution = 'POISSON' | 'UNIFORM' | 'BURST' | 'CONSTANT';

export type BackoffAlgorithm =
  | 'BINARY_EXPONENTIAL'
  | 'TRUNCATED_BINARY_EXPONENTIAL'
  | 'LINEAR'
  | 'UNIFORM_RANDOM'
  | 'CONSTANT';

export interface ProtocolParameters {
  p_persistence?: number;
  slot_time_us?: number;
  jam_time_us?: number;
  backoff_algorithm?: BackoffAlgorithm;
  max_backoff_exponent?: number;
  max_retry_limit?: number;
  interframe_spacing_us?: number;
}

