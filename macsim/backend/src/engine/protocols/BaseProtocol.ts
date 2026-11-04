import { SimulationClock } from '../SimulationClock.js';
import { EventQueue } from '../EventQueue.js';
import { SharedMedium } from '../SharedMedium.js';
import { RandomGenerator } from '../RandomGenerator.js';
import { BackoffManager } from '../BackoffManager.js';
import { StationModel } from '../../types/station.types.js';
import { FrameModel, TransmissionAttemptModel } from '../../types/frame.types.js';
import { SimulationEventModel } from '../../types/event.types.js';
import { SimulationConfig } from '../../types/simulation.types.js';
import { SimulationMetricsModel } from '../../types/metrics.types.js';

export interface ProtocolContext {
  clock: SimulationClock;
  eventQueue: EventQueue;
  medium: SharedMedium;
  rng: RandomGenerator;
  backoffManager: BackoffManager;
  stations: Map<string, StationModel>;
  stationQueues: Map<string, FrameModel[]>;
  activeStationFrames: Map<string, FrameModel>;
  stationRngs: Map<string, RandomGenerator>;
  config: SimulationConfig;
  recordEvent: (
    eventType: string,
    stationId: string | null,
    frameId: string | null,
    details: Record<string, unknown>
  ) => SimulationEventModel;
  recordFrameTransmitted: (frame: FrameModel, success: boolean) => void;
  recordCollision: (frame: FrameModel) => void;
  recordDrop: (frame: FrameModel) => void;
}

export abstract class BaseProtocol {
  protected ctx: ProtocolContext;

  constructor(ctx: ProtocolContext) {
    this.ctx = ctx;
  }

  /**
   * Calculate transmission duration in integer microseconds: (size_bytes * 8) / (bandwidth_bps / 1e6)
   */
  public calculateTransmissionDurationUs(sizeBytes: number): number {
    const bits = sizeBytes * 8;
    const bandwidthBps = this.ctx.config.channel_bandwidth_bps;
    return Math.max(1, Math.round((bits / bandwidthBps) * 1_000_000));
  }

  /**
   * Records a transmission attempt on a frame model to maintain complete attempt history.
   */
  protected recordAttempt(
    frame: FrameModel,
    attemptNumber: number,
    startTime: number,
    endTime: number,
    status: 'TRANSMITTING' | 'SUCCESSFUL' | 'COLLIDED' | 'ABORTED'
  ): TransmissionAttemptModel {
    if (!frame.attempts) {
      frame.attempts = [];
    }
    const attempt: TransmissionAttemptModel = {
      id: `${frame.id}_att_${attemptNumber}`,
      frame_id: frame.id,
      attempt_number: attemptNumber,
      start_time: Math.round(startTime),
      end_time: Math.round(endTime),
      status,
    };
    frame.attempts.push(attempt);
    return attempt;
  }

  /**
   * Updates status of the latest attempt on a frame.
   */
  protected updateLatestAttempt(
    frame: FrameModel,
    status: 'SUCCESSFUL' | 'COLLIDED' | 'ABORTED',
    endTime?: number
  ): void {
    if (frame.attempts && frame.attempts.length > 0) {
      const latest = frame.attempts[frame.attempts.length - 1];
      latest.status = status;
      if (endTime !== undefined) {
        latest.end_time = Math.round(endTime);
      }
    }
  }

  /**
   * Hook when a new frame is generated at a station.
   */
  public abstract onFrameGenerated(station: StationModel, frame: FrameModel): void;

  /**
   * Hook when a transmission attempt ends.
   */
  public abstract onTransmissionComplete(station: StationModel, frame: FrameModel): void;

  /**
   * Protocol-specific metric additions (e.g. Slotted ALOHA slots, CSMA carrier sense stats).
   */
  public getProtocolMetrics?(): Partial<SimulationMetricsModel>;
}
