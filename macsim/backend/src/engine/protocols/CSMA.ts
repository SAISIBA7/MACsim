import { BaseProtocol, ProtocolContext } from './BaseProtocol.js';
import { StationModel } from '../../types/station.types.js';
import { FrameModel } from '../../types/frame.types.js';
import { SimulationMetricsModel } from '../../types/metrics.types.js';
import { EVENT_TYPES, STATION_STATES, FRAME_STATUS, DEFAULTS } from '../../config/constants.js';

export type CSMAPersistence = '1-PERSISTENT' | 'NON-PERSISTENT' | 'P-PERSISTENT';

export class CSMAProtocol extends BaseProtocol {
  private persistence: CSMAPersistence;
  private pValue: number;
  private slotTimeUs: number;
  private interframeSpacingUs: number;

  constructor(ctx: ProtocolContext, persistence: CSMAPersistence = '1-PERSISTENT') {
    super(ctx);
    this.persistence = persistence;
    this.pValue = this.ctx.config.p_persistence ?? 0.5;
    this.slotTimeUs = this.ctx.config.slot_time_us ?? DEFAULTS.SLOT_TIME_CSMA_US;
    this.interframeSpacingUs = DEFAULTS.INTERFRAME_SPACING_US;
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

    // Increment carrier sensing stats on station
    station.carrier_sense_attempts = (station.carrier_sense_attempts ?? 0) + 1;

    // Carrier sensing incorporates propagation delay tau
    const isBusy = this.ctx.medium.isCarrierSensedBusy(currentTime, station.id);

    if (isBusy) {
      // Channel is BUSY
      station.carrier_sense_busy_count = (station.carrier_sense_busy_count ?? 0) + 1;

      this.ctx.recordEvent(EVENT_TYPES.CARRIER_SENSED_BUSY, station.id, frame.id, {
        persistence: this.persistence,
        currentTime,
        message: `Station ${station.id} sensed medium BUSY; deferring transmission`,
      });

      if (this.persistence === '1-PERSISTENT') {
        // 1-persistent: check again after slot time / sensing interval
        const checkTime = currentTime + this.slotTimeUs;
        station.next_attempt_time = checkTime;
        station.total_waiting_time_us = (station.total_waiting_time_us ?? 0) + this.slotTimeUs;

        this.ctx.eventQueue.push({
          id: `csma_sense_${station.id}_${checkTime}`,
          time: checkTime,
          priority: 2,
          type: 'CSMA_SENSE_RETRY',
          stationId: station.id,
          handler: () => {
            this.senseAndTransmit(station);
          },
        });
      } else if (this.persistence === 'NON-PERSISTENT') {
        // Non-persistent: back off a random interval before sensing again
        const stationRng = this.ctx.stationRngs.get(station.id) || this.ctx.rng;
        const windowSize = Math.pow(2, Math.min(frame.attempt_count || 1, 10));
        const chosenSlot = stationRng.randint(1, windowSize);
        const delayUs = Math.max(this.slotTimeUs, chosenSlot * this.slotTimeUs);

        station.state = STATION_STATES.BACKOFF;
        station.backoff_count += 1;
        station.current_backoff_window = windowSize;
        const retryTime = currentTime + delayUs;
        station.next_attempt_time = retryTime;
        station.total_waiting_time_us = (station.total_waiting_time_us ?? 0) + delayUs;

        this.ctx.recordEvent(EVENT_TYPES.BACKOFF_STARTED, station.id, frame.id, {
          reason: 'CHANNEL_BUSY',
          delayUs,
          retryTime,
        });

        this.ctx.eventQueue.push({
          id: `csma_nonpers_retry_${station.id}_${retryTime}`,
          time: retryTime,
          priority: 3,
          type: 'BACKOFF_END',
          stationId: station.id,
          handler: () => {
            station.state = STATION_STATES.IDLE;
            station.next_attempt_time = null;
            this.ctx.recordEvent(EVENT_TYPES.BACKOFF_COMPLETED, station.id, frame.id, {
              resumingAt: this.ctx.clock.currentTime,
            });
            this.senseAndTransmit(station);
          },
        });
      } else if (this.persistence === 'P-PERSISTENT') {
        const checkTime = currentTime + this.slotTimeUs;
        station.next_attempt_time = checkTime;
        station.total_waiting_time_us = (station.total_waiting_time_us ?? 0) + this.slotTimeUs;

        this.ctx.eventQueue.push({
          id: `csma_p_pers_busy_${station.id}_${checkTime}`,
          time: checkTime,
          priority: 2,
          type: 'CSMA_SENSE_RETRY',
          stationId: station.id,
          handler: () => {
            this.senseAndTransmit(station);
          },
        });
      }
    } else {
      // Channel is IDLE
      station.carrier_sense_idle_count = (station.carrier_sense_idle_count ?? 0) + 1;

      this.ctx.recordEvent(EVENT_TYPES.CARRIER_SENSED_IDLE, station.id, frame.id, {
        persistence: this.persistence,
        currentTime,
        message: `Station ${station.id} sensed medium IDLE; ready to transmit`,
      });

      if (this.persistence === 'P-PERSISTENT') {
        const stationRng = this.ctx.stationRngs.get(station.id) || this.ctx.rng;
        const transmitNow = stationRng.bernoulli(this.pValue);
        if (transmitNow) {
          this.startTransmission(station, frame);
        } else {
          // Defer by 1 slot time
          const deferTime = currentTime + this.slotTimeUs;
          station.next_attempt_time = deferTime;
          station.total_waiting_time_us = (station.total_waiting_time_us ?? 0) + this.slotTimeUs;

          this.ctx.eventQueue.push({
            id: `csma_p_pers_defer_${station.id}_${deferTime}`,
            time: deferTime,
            priority: 2,
            type: 'CSMA_P_PERSISTENT_DEFER',
            stationId: station.id,
            handler: () => {
              this.senseAndTransmit(station);
            },
          });
        }
      } else {
        // Standard CSMA / 1-persistent transmits immediately upon sensing idle
        this.startTransmission(station, frame);
      }
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

    // Record this individual transmission attempt
    this.recordAttempt(frame, frame.attempt_count, startTime, endTime, 'TRANSMITTING');

    this.ctx.activeStationFrames.set(station.id, frame);

    // Medium registers transmission and calculates propagation delay overlaps
    const txResult = this.ctx.medium.startTransmission(station.id, frame.id, startTime, endTime);

    this.ctx.recordEvent(EVENT_TYPES.TRANSMISSION_STARTED, station.id, frame.id, {
      attemptNumber: frame.attempt_count,
      durationUs,
      startTime,
      endTime,
      isOverlap: txResult.isCollision,
    });

    if (txResult.isCollision && txResult.isNewIncident) {
      this.ctx.recordEvent(EVENT_TYPES.COLLISION_DETECTED, station.id, frame.id, {
        incidentId: txResult.incidentId,
        collidedWith: txResult.collidedTransmissions.map((t) => t.frameId),
        message: `Collision in CSMA due to transmission within propagation delay window (tau)`,
      });
    }

    // In ordinary CSMA without Collision Detection, the station does not abort early.
    // The entire frame transmits until endTime.
    this.ctx.eventQueue.push({
      id: `csma_tx_end_${frame.id}_${frame.attempt_count}`,
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
      // Collision occurred (e.g. transmissions started within propagation delay)
      frame.status = FRAME_STATUS.COLLIDED;
      frame.collision_count += 1;
      this.updateLatestAttempt(frame, 'COLLIDED', this.ctx.clock.currentTime);

      station.frames_collided += 1;
      station.state = STATION_STATES.COLLISION;

      this.ctx.recordCollision(frame);
      this.ctx.recordEvent(EVENT_TYPES.COLLISION_DETECTED, station.id, frame.id, {
        collisionCount: frame.collision_count,
        attempts: frame.attempt_count,
        collidedWith: tx?.collidedWith || [],
      });

      const maxRetry = this.ctx.config.max_retry_limit ?? 16;
      if (frame.attempt_count >= maxRetry) {
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
        // Binary Exponential Backoff with station-isolated RNG
        const stationRng = this.ctx.stationRngs.get(station.id) || this.ctx.rng;
        const exponent = Math.min(frame.attempt_count, 10);
        const windowSize = Math.pow(2, exponent);
        const chosenSlot = stationRng.randint(0, windowSize - 1);
        const delayUs = Math.round(chosenSlot * this.slotTimeUs);

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
          slotTimeUs: this.slotTimeUs,
        });

        this.ctx.eventQueue.push({
          id: `csma_backoff_end_${station.id}_${frame.id}`,
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
