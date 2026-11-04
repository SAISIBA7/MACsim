import { BaseProtocol, ProtocolContext } from './BaseProtocol.js';
import { StationModel } from '../../types/station.types.js';
import { FrameModel } from '../../types/frame.types.js';
import { EVENT_TYPES, STATION_STATES, FRAME_STATUS } from '../../config/constants.js';

export class PureAlohaProtocol extends BaseProtocol {
  constructor(ctx: ProtocolContext) {
    super(ctx);
  }

  public onFrameGenerated(station: StationModel, frame: FrameModel): void {
    const queue = this.ctx.stationQueues.get(station.id) || [];
    queue.push(frame);
    this.ctx.stationQueues.set(station.id, queue);
    station.queue_length = queue.length;

    // Station emits FRAME_GENERATED
    // In Pure ALOHA, if station is IDLE (not transmitting or in backoff), transmit immediately
    if (station.state === STATION_STATES.IDLE && !this.ctx.activeStationFrames.has(station.id)) {
      this.attemptTransmission(station);
    } else if (station.state !== STATION_STATES.TRANSMITTING && station.state !== STATION_STATES.BACKOFF) {
      station.state = STATION_STATES.WAITING;
    }
  }

  public attemptTransmission(station: StationModel): void {
    const queue = this.ctx.stationQueues.get(station.id);
    if (!queue || queue.length === 0) {
      station.state = STATION_STATES.IDLE;
      station.next_attempt_time = null;
      return;
    }

    const frame = queue[0];
    const durationUs = this.calculateTransmissionDurationUs(frame.size_bytes);
    const startTime = this.ctx.clock.currentTime;
    const endTime = startTime + durationUs;

    station.state = STATION_STATES.TRANSMITTING;
    station.next_attempt_time = null;
    frame.status = FRAME_STATUS.TRANSMITTING;
    frame.transmission_start_time = startTime;
    frame.transmission_end_time = endTime;
    frame.attempt_count += 1;

    // Record this individual transmission attempt
    this.recordAttempt(frame, frame.attempt_count, startTime, endTime, 'TRANSMITTING');

    this.ctx.activeStationFrames.set(station.id, frame);

    // Medium monitors overlap considering vulnerable period 2*T_f
    const txResult = this.ctx.medium.startTransmission(station.id, frame.id, startTime, endTime);

    this.ctx.recordEvent(EVENT_TYPES.TRANSMISSION_STARTED, station.id, frame.id, {
      attemptNumber: frame.attempt_count,
      durationUs,
      startTime,
      endTime,
      vulnerablePeriodUs: 2 * durationUs,
      isOverlap: txResult.isCollision,
    });

    if (txResult.isCollision && txResult.isNewIncident) {
      this.ctx.recordEvent(EVENT_TYPES.COLLISION_DETECTED, station.id, frame.id, {
        incidentId: txResult.incidentId,
        vulnerableIntervalUs: 2 * durationUs,
        collidedWith: txResult.collidedTransmissions.map((t) => t.frameId),
      });
    }

    // Schedule transmission end at exactly endTime
    this.ctx.eventQueue.push({
      id: `pure_aloha_end_${frame.id}_${frame.attempt_count}`,
      time: endTime,
      priority: 2,
      type: 'TRANSMISSION_COMPLETE',
      stationId: station.id,
      frameId: frame.id,
      handler: () => {
        this.onTransmissionComplete(station, frame);
      },
    });
  }

  public onTransmissionComplete(station: StationModel, frame: FrameModel): void {
    const tx = this.ctx.medium.endTransmission(frame.id, this.ctx.clock.currentTime);
    this.ctx.activeStationFrames.delete(station.id);

    const isCollided = tx ? tx.isCollided : false;

    if (!isCollided) {
      // Clean transmission delivery!
      frame.status = FRAME_STATUS.SUCCESSFUL;
      this.updateLatestAttempt(frame, 'SUCCESSFUL', this.ctx.clock.currentTime);

      station.frames_transmitted += 1;
      station.state = STATION_STATES.IDLE;

      // Dequeue delivered frame
      const queue = this.ctx.stationQueues.get(station.id) || [];
      if (queue.length > 0 && queue[0].id === frame.id) {
        queue.shift();
      }
      station.queue_length = queue.length;

      const latencyUs = this.ctx.clock.currentTime - frame.generation_time;

      this.ctx.recordFrameTransmitted(frame, true);
      this.ctx.recordEvent(EVENT_TYPES.TRANSMISSION_COMPLETED, station.id, frame.id, {
        attempts: frame.attempt_count,
        completionTime: this.ctx.clock.currentTime,
        latencyUs,
        latencyMs: latencyUs / 1000,
      });

      // Attempt next frame if queue not empty
      if (queue.length > 0) {
        this.attemptTransmission(station);
      }
    } else {
      // Collision occurred!
      frame.status = FRAME_STATUS.COLLIDED;
      frame.collision_count += 1;
      this.updateLatestAttempt(frame, 'COLLIDED', this.ctx.clock.currentTime);

      station.frames_collided += 1;
      station.state = STATION_STATES.COLLISION;

      this.ctx.recordCollision(frame);

      const maxRetry = this.ctx.config.max_retry_limit ?? 16;
      if (frame.attempt_count >= maxRetry) {
        // Retry limit exhausted -> Drop frame
        frame.status = FRAME_STATUS.DROPPED;
        station.frames_dropped += 1;
        station.state = STATION_STATES.IDLE;

        const queue = this.ctx.stationQueues.get(station.id) || [];
        if (queue.length > 0 && queue[0].id === frame.id) {
          queue.shift();
        }
        station.queue_length = queue.length;

        this.ctx.recordDrop(frame);
        this.ctx.recordEvent(EVENT_TYPES.FRAME_DROPPED, station.id, frame.id, {
          attempts: frame.attempt_count,
          maxRetryLimit: maxRetry,
          reason: 'RETRY_LIMIT_EXHAUSTED',
        });

        if (queue.length > 0) {
          this.attemptTransmission(station);
        }
      } else {
        // Schedule randomized backoff
        const stationRng = this.ctx.stationRngs.get(station.id) || this.ctx.rng;
        const frameDurationUs = this.calculateTransmissionDurationUs(frame.size_bytes);
        // ALOHA backoff: R * frameDuration where R in [0, 2^k - 1]
        const exponent = Math.min(frame.attempt_count, 10);
        const windowSize = Math.pow(2, exponent);
        const chosenSlot = stationRng.randint(0, windowSize - 1);
        const delayUs = Math.round(chosenSlot * frameDurationUs);

        station.state = STATION_STATES.BACKOFF;
        station.backoff_count += 1;
        station.current_backoff_window = windowSize;

        const retryTime = this.ctx.clock.currentTime + delayUs;
        station.next_attempt_time = retryTime;

        this.ctx.recordEvent(EVENT_TYPES.BACKOFF_STARTED, station.id, frame.id, {
          attemptNumber: frame.attempt_count,
          delayUs,
          delayMs: delayUs / 1000,
          retryTime,
          chosenSlot,
          windowSize,
        });

        this.ctx.eventQueue.push({
          id: `pure_aloha_retry_${station.id}_${frame.id}_${frame.attempt_count}`,
          time: retryTime,
          priority: 3,
          type: 'BACKOFF_END',
          stationId: station.id,
          frameId: frame.id,
          handler: () => {
            station.state = STATION_STATES.IDLE;
            station.next_attempt_time = null;
            this.ctx.recordEvent(EVENT_TYPES.BACKOFF_COMPLETED, station.id, frame.id, {
              resumingAt: this.ctx.clock.currentTime,
            });
            this.attemptTransmission(station);
          },
        });
      }
    }
  }
}
