import { StationState } from '../config/constants.js';

export interface StationModel {
  id: string;
  simulation_id: string;
  station_index: number;
  name: string;
  state: StationState;
  frames_generated: number;
  frames_transmitted: number;
  frames_collided: number;
  frames_dropped: number;
  backoff_count: number;
  current_backoff_window: number;
  next_attempt_time: number | null;
  queue_length: number;
  total_waiting_time_us?: number;
  carrier_sense_attempts?: number;
  carrier_sense_busy_count?: number;
  carrier_sense_idle_count?: number;
}
