import { FrameStatus } from '../config/constants.js';

export interface TransmissionAttemptModel {
  id: string;
  frame_id: string;
  attempt_number: number;
  start_time: number;
  end_time: number;
  status: 'TRANSMITTING' | 'SUCCESSFUL' | 'COLLIDED' | 'ABORTED';
}

export interface FrameModel {
  id: string;
  simulation_id: string;
  frame_id: number;
  station_id: string;
  size_bytes: number;
  generation_time: number;
  transmission_start_time: number | null;
  transmission_end_time: number | null;
  status: FrameStatus;
  attempt_count: number;
  collision_count: number;
  attempts?: TransmissionAttemptModel[];
}

