import { ProtocolType, SimulationStatus } from '../config/constants.js';
import { TrafficDistribution } from './protocol.types.js';
import { StationModel } from './station.types.js';
import { FrameModel } from './frame.types.js';
import { SimulationEventModel } from './event.types.js';
import { SimulationMetricsModel } from './metrics.types.js';

export interface StationSpecificConfig {
  station_index: number;
  traffic_rate_multiplier?: number;
  frame_size_bytes?: number;
}

export interface SimulationConfig {
  protocol: ProtocolType;
  num_stations: number;
  simulation_time_us: number;
  arrival_rate_lambda: number;
  traffic_distribution: TrafficDistribution;
  frame_size_bytes: number;
  channel_bandwidth_bps: number;
  propagation_delay_us: number;
  slot_time_us?: number;
  p_persistence?: number;
  jam_time_us?: number;
  max_retry_limit?: number;
  random_seed?: number;
  name?: string;
  station_configs?: StationSpecificConfig[];
}

export interface SimulationModel {
  id: string;
  name: string | null;
  protocol: ProtocolType;
  status: SimulationStatus;
  current_time: number;
  max_simulation_time: number;
  random_seed: number | null;
  config: SimulationConfig;
  created_at: Date;
  updated_at: Date;
  stations?: StationModel[];
  frames?: FrameModel[];
  events?: SimulationEventModel[];
  metrics?: SimulationMetricsModel | null;
}

