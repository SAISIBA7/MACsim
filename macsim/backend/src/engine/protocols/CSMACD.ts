import { BaseProtocol, ProtocolContext } from './BaseProtocol.js';
import { StationModel } from '../../types/station.types.js';
import { FrameModel } from '../../types/frame.types.js';
import { SimulationMetricsModel } from '../../types/metrics.types.js';
import { EVENT_TYPES, STATION_STATES, FRAME_STATUS, DEFAULTS } from '../../config/constants.js';

export class CSMACDProtocol extends BaseProtocol {
  private jamTimeUs: number;
  private slotTimeUs: number;
  private propagationDelayUs: number;
  private abortedCount: number = 0;

  constructor(ctx: ProtocolContext) {
    super(ctx);
    this.jamTimeUs = this.ctx.config.jam_time_us ?? DEFAULTS.JAM_SIGNAL_TIME_US;
    this.slotTimeUs = this.ctx.config.slot_time_us ?? DEFAULTS.SLOT_TIME_CSMA_US;
    this.propagationDelayUs = this.ctx.config.propagation_delay_us ?? DEFAULTS.PROPAGATION_DELAY_US;
  }

  public onFrameGenerated(station: StationModel, frame: FrameModel): void {
    const queue = this.ctx.stationQueues.get(station.id) || [];
    queue.push(frame);
    this.ctx.stationQueues.set(station.id, queue);
    station.queue_length = queue.length;

    if (station.state === STATION_STATES.IDLE && !this.ctx.activeStationFrames.has(station.id)) {
      this.senseAndTransmit(station);
    } else if (
      station.state !== STATION_STATES.TRANSMITTING &&
      station.state !== STATION_STATES.BACKOFF &&
      station.state !== STATION_STATES.SENSING
    ) {
      station.state = STATION_STATES.WAITING;
    }
  }

  public senseAndTransmit(station: StationModel): void {
    const queue = this.ctx.stationQueues.get(station.id);
    if (!queue || queue.length === 0) {
      station.state = STATION_STATES.IDLE;
      station.next_attempt_time = null;
      return;
    }

    const frame = queue[0];
    const currentTime = this.ctx.clock.currentTime;
    station.state = STATION_STATES.SENSING;

    station.carrier_sense_attempts = (station.carrier_sense_attempts ?? 0) + 1;

    // Carrier sensing incorporates propagation delay tau
    const isBusy = this.ctx.medium.isCarrierSensedBusy(currentTime, station.id);

    if (isBusy) {
      station.carrier_sense_busy_count = (station.carrier_sense_busy_count ?? 0) + 1;

      this.ctx.recordEvent(EVENT_TYPES.CARRIER_SENSED_BUSY, station.id, frame.id, {
        protocol: 'CSMA_CD',
        currentTime,
        message: `Station ${station.id} sensed medium BUSY in CSMA/CD; waiting`,
      });

      const checkTime = currentTime + this.slotTimeUs;
      station.next_attempt_time = checkTime;
      station.total_waiting_time_us = (station.total_waiting_time_us ?? 0) + this.slotTimeUs;

      this.ctx.eventQueue.push({
        id: `csmacd_sense_${station.id}_${checkTime}`,
        time: checkTime,
        priority: 2,
        type: 'CSMA_CD_SENSE_RETRY',
        stationId: station.id,
        handler: () => {
          this.senseAndTransmit(station);
        },
      });
    } else {
      station.carrier_sense_idle_count = (station.carrier_sense_idle_count ?? 0) + 1;

      this.ctx.recordEvent(EVENT_TYPES.CARRIER_SENSED_IDLE, station.id, frame.id, {
        protocol: 'CSMA_CD',
        currentTime,
        message: `Station ${station.id} sensed medium IDLE in CSMA/CD; initiating transmission with CD`,
      });
      this.startTransmission(station, frame);
    }
  }

  private startTransmission(station: StationModel, frame: FrameModel): void {
    const durationUs = this.calculateTransmissionDurationUs(frame.size_bytes);
    const startTime = this.ctx.clock.currentTime;
    const endTime = startTime + durationUs;

    station.state = STATION_STATES.TRANSMITTING;
    station.next_attempt_time = null;
    frame.status = FRAME_STATUS.TRANSMITTING;
    frame.transmission_start_time = startTime;
    frame.transmission_end_time = endTime;
    frame.attempt_count += 1;

    // Record this individual attempt
    this.recordAttempt(frame, frame.attempt_count, startTime, endTime, 'TRANSMITTING');

    this.ctx.activeStationFrames.set(station.id, frame);

    const txResult = this.ctx.medium.startTransmission(station.id, frame.id, startTime, endTime);

    this.ctx.recordEvent(EVENT_TYPES.TRANSMISSION_STARTED, station.id, frame.id, {
      attemptNumber: frame.attempt_count,
      durationUs,
      startTime,
      endTime,
      isOverlap: txResult.isCollision,
    });

    if (txResult.isCollision) {
      // Collision detected! "Listen while talking" hardware detects collision within 2*tau.
      // Every colliding station transmits a 32-bit jam signal and aborts early.
      for (const collidedTx of txResult.collidedTransmissions) {
        const collidedStation = this.ctx.stations.get(collidedTx.stationId);
        const collidedFrame = this.ctx.activeStationFrames.get(collidedTx.stationId);

        if (collidedStation && collidedFrame) {
          const detectionTime = Math.max(
            startTime + 1,
            Math.max(startTime, collidedTx.startTime) + Math.round(this.propagationDelayUs)
          );
          const abortTime = Math.round(detectionTime + this.jamTimeUs);
          this.scheduleCollisionAbort(collidedStation, collidedFrame, abortTime);
        }
      }
    }

    // Always schedule normal completion event; it will no-op if early collision abort occurred
    this.ctx.eventQueue.push({
      id: `csmacd_tx_end_${frame.id}_${frame.attempt_count}`,
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

  private scheduleCollisionAbort(
    station: StationModel,
    frame: FrameModel,
    abortTime: number
  ): void {
    this.ctx.eventQueue.push({
      id: `csmacd_abort_${frame.id}_${frame.attempt_count}_${abortTime}`,
      time: abortTime,
      priority: 1, // Higher priority than normal completion
      type: 'COLLISION_ABORT',
      stationId: station.id,
      frameId: frame.id,
      handler: () => {
        this.handleCollisionAbort(station, frame);
      },
    });
  }

  private handleCollisionAbort(station: StationModel, frame: FrameModel): void {
    if (!this.ctx.activeStationFrames.has(station.id)) {
      return; // Already completed or aborted
    }

    const abortTime = this.ctx.clock.currentTime;
    this.ctx.medium.endTransmission(frame.id, abortTime);
    this.ctx.activeStationFrames.delete(station.id);
    this.abortedCount += 1;

    frame.status = FRAME_STATUS.COLLIDED;
    frame.collision_count += 1;
    frame.transmission_end_time = abortTime;
    this.updateLatestAttempt(frame, 'ABORTED', abortTime);

    station.frames_collided += 1;
    station.state = STATION_STATES.COLLISION;

    this.ctx.recordCollision(frame);
    this.ctx.recordEvent(EVENT_TYPES.COLLISION_DETECTED, station.id, frame.id, {
      abortedEarly: true,
      jamSignalSent: true,
      jamTimeUs: this.jamTimeUs,
      attempts: frame.attempt_count,
      abortedAt: abortTime,
      abortedDurationUs: abortTime - (frame.transmission_start_time ?? abortTime),
      message: `Collision detected via listen-while-talking! Transmission aborted; 32-bit jam signal transmitted (${this.jamTimeUs}µs)`,
    });

    const maxRetry = this.ctx.config.max_retry_limit ?? 16;
    if (frame.attempt_count >= maxRetry) {
      // Exceeded max 16 retries -> drop frame
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
        this.senseAndTransmit(station);
      }
    } else {
      // IEEE 802.3 Truncated Binary Exponential Backoff:
      // k = min(n, 10), R in [0, 2^k - 1], slot time = 51.2us (512 bit-times at 10 Mbps)
      const stationRng = this.ctx.stationRngs.get(station.id) || this.ctx.rng;
      const exponent = Math.min(frame.attempt_count, 10);
      const windowSize = Math.pow(2, exponent);
      const chosenSlot = stationRng.randint(0, windowSize - 1);
      const delayUs = Math.round(chosenSlot * this.slotTimeUs);

      station.state = STATION_STATES.BACKOFF;
      station.backoff_count += 1;
      station.current_backoff_window = windowSize;

      const retryTime = abortTime + delayUs;
      station.next_attempt_time = retryTime;

      this.ctx.recordEvent(EVENT_TYPES.BACKOFF_STARTED, station.id, frame.id, {
        attemptNumber: frame.attempt_count,
        delayUs,
        delayMs: delayUs / 1000,
        retryTime,
        chosenSlot,
        windowSize,
        slotTimeUs: this.slotTimeUs,
        standard: 'IEEE 802.3 Binary Exponential Backoff',
      });

      this.ctx.eventQueue.push({
        id: `csmacd_backoff_end_${station.id}_${frame.id}`,
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
          this.senseAndTransmit(station);
        },
      });
    }
  }

  public onTransmissionComplete(station: StationModel, frame: FrameModel): void {
    if (!this.ctx.activeStationFrames.has(station.id)) {
      // Transmission was already aborted by collision detection handler
      return;
    }

    const tx = this.ctx.medium.endTransmission(frame.id, this.ctx.clock.currentTime);
    this.ctx.activeStationFrames.delete(station.id);

    const isCollided = tx ? tx.isCollided : false;

    if (!isCollided) {
      // Clean transmission delivery
      frame.status = FRAME_STATUS.SUCCESSFUL;
      this.updateLatestAttempt(frame, 'SUCCESSFUL', this.ctx.clock.currentTime);

      station.frames_transmitted += 1;
      station.state = STATION_STATES.IDLE;

      const queue = this.ctx.stationQueues.get(station.id) || [];
      if (queue.length > 0 && queue[0].id === frame.id) {
        queue.shift();
      }
      station.queue_length = queue.length;

      this.ctx.recordFrameTransmitted(frame, true);
      this.ctx.recordEvent(EVENT_TYPES.TRANSMISSION_COMPLETED, station.id, frame.id, {
        attempts: frame.attempt_count,
        completionTime: this.ctx.clock.currentTime,
        latencyUs: this.ctx.clock.currentTime - frame.generation_time,
      });

      if (queue.length > 0) {
        this.senseAndTransmit(station);
      }
    } else {
      this.handleCollisionAbort(station, frame);
    }
  }

  public getProtocolMetrics(): Partial<SimulationMetricsModel> {
    let totalAttempts = 0;
    let totalBusy = 0;
    let totalIdle = 0;
    let totalWaiting = 0;

    for (const station of this.ctx.stations.values()) {
      totalAttempts += station.carrier_sense_attempts ?? 0;
      totalBusy += station.carrier_sense_busy_count ?? 0;
      totalIdle += station.carrier_sense_idle_count ?? 0;
      totalWaiting += station.total_waiting_time_us ?? 0;
    }

    return {
      average_waiting_time_us: totalAttempts > 0 ? totalWaiting / totalAttempts : 0,
    };
  }
}
