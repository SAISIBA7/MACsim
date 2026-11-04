export interface SimulationMetricsModel {
  id?: string;
  simulation_id: string;
  total_frames_generated: number;
  total_frames_transmitted: number;
  total_collisions: number;
  total_dropped: number;
  collision_rate: number;
  throughput_bps: number;
  goodput_bps?: number;
  channel_efficiency: number;
  average_latency_us: number;
  average_attempts: number;
  channel_busy_time_us: number;
  channel_idle_time_us: number;
  channel_collision_time_us: number;
  theoretical_efficiency: number | null;

  // Refined research metrics
  collision_incidents?: number;
  collided_attempts?: number;
  retransmissions?: number;
  packet_delivery_ratio?: number;
  drop_rate?: number;
  average_waiting_time_us?: number;

  // Slotted ALOHA specific metrics
  total_slots?: number;
  idle_slots?: number;
  successful_slots?: number;
  collided_slots?: number;
  slot_utilization?: number;
}
