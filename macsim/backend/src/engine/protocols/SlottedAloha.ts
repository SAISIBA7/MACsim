import { BaseProtocol, ProtocolContext } from './BaseProtocol.js';
import { StationModel } from '../../types/station.types.js';
import { FrameModel } from '../../types/frame.types.js';
import { SimulationMetricsModel } from '../../types/metrics.types.js';
import { EVENT_TYPES, STATION_STATES, FRAME_STATUS, DEFAULTS } from '../../config/constants.js';

interface SlotRecord {
  count: number;
  frameIds: string[];
  success: boolean;
}

export class SlottedAlohaProtocol extends BaseProtocol {
  private slotTimeUs: number;
  private slotRecords: Map<number, SlotRecord> = new Map();

  constructor(ctx: ProtocolContext) {
    super(ctx);
    this.slotTimeUs =
      this.ctx.config.slot_time_us ??
      this.calculateTransmissionDurationUs(this.ctx.config.frame_size_bytes) ??
      DEFAULTS.SLOT_TIME_ALOHA_US;
  }

  /**
   * Calculates the next discrete slot boundary >= timeUs.
   * If timeUs is strictly on a slot boundary, it returns timeUs.
   */
  public getNextSlotBoundary(timeUs: number): number {
    const remainder = timeUs % this.slotTimeUs;
    if (remainder === 0) {
      return timeUs;
    }
    return timeUs + (this.slotTimeUs - remainder);
  }

  /**
   * Calculates the slot boundary strictly after timeUs.
   */
  public getStrictNextSlotBoundary(timeUs: number): number {
    const slotIndex = Math.floor(timeUs / this.slotTimeUs);
    return (slotIndex + 1) * this.slotTimeUs;
  }

  public onFrameGenerated(station: StationModel, frame: FrameModel): void {
    const queue = this.ctx.stationQueues.get(station.id) || [];
    queue.push(frame);
    this.ctx.stationQueues.set(station.id, queue);
    station.queue_length = queue.length;

    // In Slotted ALOHA, stations cannot transmit immediately; they must wait for the next slot boundary
    if (station.state === STATION_STATES.IDLE && !this.ctx.activeStationFrames.has(station.id)) {
      this.scheduleSlotTransmission(station);
    } else if (
      station.state !== STATION_STATES.TRANSMITTING &&
      station.state !== STATION_STATES.BACKOFF &&
      station.state !== STATION_STATES.WAITING
    ) {
      station.state = STATION_STATES.WAITING;
    }
  }

  public scheduleSlotTransmission(station: StationModel): void {
    const currentTime = this.ctx.clock.currentTime;
    // Align strictly to the next slot boundary in the future
    const nextSlot = this.getStrictNextSlotBoundary(currentTime);

    station.state = STATION_STATES.WAITING;
    station.next_attempt_time = nextSlot;

    this.ctx.eventQueue.push({
      id: `slot_tx_${station.id}_${nextSlot}`,
      time: nextSlot,
      priority: 1, // slot boundaries have high priority
      type: 'SLOT_BOUNDARY_TX',
      stationId: station.id,
      handler: () => {
        this.attemptTransmissionAtSlot(station);
      },
    });
  }

  public attemptTransmissionAtSlot(station: StationModel): void {
    // If station is currently in backoff or actively transmitting, ignore
    if (
      station.state === STATION_STATES.BACKOFF ||
      this.ctx.activeStationFrames.has(station.id)
    ) {
      return;
    }

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

    const slotIndex = Math.floor(startTime / this.slotTimeUs);

    // Track transmission attempts inside this discrete slot
    let record = this.slotRecords.get(slotIndex);
    if (!record) {
      record = { count: 0, frameIds: [], success: true };
      this.slotRecords.set(slotIndex, record);
    }
    record.count += 1;
    record.frameIds.push(frame.id);
    if (record.count > 1) {
      record.success = false;
    }

    station.state = STATION_STATES.TRANSMITTING;
    station.next_attempt_time = null;
    frame.status = FRAME_STATUS.TRANSMITTING;
    frame.transmission_start_time = startTime;
    frame.transmission_end_time = endTime;
    frame.attempt_count += 1;

    // Record this individual attempt
    this.recordAttempt(frame, frame.attempt_count, startTime, endTime, 'TRANSMITTING');

    this.ctx.activeStationFrames.set(station.id, frame);

    // Physical medium registers transmission
    const txResult = this.ctx.medium.startTransmission(station.id, frame.id, startTime, endTime);

    this.ctx.recordEvent(EVENT_TYPES.TRANSMISSION_STARTED, station.id, frame.id, {
      attemptNumber: frame.attempt_count,
      durationUs,
      startTime,
      endTime,
      slotIndex,
      slotTimeUs: this.slotTimeUs,
      isOverlap: txResult.isCollision || record.count > 1,
    });

    if ((txResult.isCollision && txResult.isNewIncident) || record.count === 2) {
      this.ctx.recordEvent(EVENT_TYPES.COLLISION_DETECTED, station.id, frame.id, {
        slotIndex,
        collidedStations: record.frameIds,
        message: `Collision in slot ${slotIndex}: multiple stations started transmitting simultaneously at slot boundary ${startTime}µs`,
      });
    }

    // Schedule completion at end of frame transmission
    this.ctx.eventQueue.push({
      id: `slot_tx_end_${frame.id}_${frame.attempt_count}`,
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

    const slotIndex = Math.floor(frame.transmission_start_time! / this.slotTimeUs);
    const slotRecord = this.slotRecords.get(slotIndex);

    // Transmission collided if medium reported collision OR multiple stations transmitted in this slot
    const isCollided = (tx ? tx.isCollided : false) || (slotRecord ? slotRecord.count > 1 : false);

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
        slotIndex,
      });

      // If queue has more pending frames, schedule next transmission at next slot boundary
      if (queue.length > 0) {
        this.scheduleSlotTransmission(station);
      }
    } else {
      // Collision occurred in this slot
      frame.status = FRAME_STATUS.COLLIDED;
      frame.collision_count += 1;
      this.updateLatestAttempt(frame, 'COLLIDED', this.ctx.clock.currentTime);

      station.frames_collided += 1;
      station.state = STATION_STATES.COLLISION;

      this.ctx.recordCollision(frame);
      this.ctx.recordEvent(EVENT_TYPES.COLLISION_DETECTED, station.id, frame.id, {
        collisionCount: frame.collision_count,
        attempts: frame.attempt_count,
        slotIndex,
        collidedWith: tx?.collidedWith || (slotRecord ? slotRecord.frameIds.filter((id) => id !== frame.id) : []),
      });

      const maxRetry = this.ctx.config.max_retry_limit ?? 16;
      if (frame.attempt_count >= maxRetry) {
        // Retry limit reached -> Drop frame
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
          slotIndex,
        });

        if (queue.length > 0) {
          this.scheduleSlotTransmission(station);
        }
      } else {
        // Backoff in discrete integer slots using station-isolated RNG
        const stationRng = this.ctx.stationRngs.get(station.id) || this.ctx.rng;
        const exponent = Math.min(frame.attempt_count, 10);
        const windowSize = Math.pow(2, exponent);
        // Choose integer backoff slots: R in [1, windowSize]
        const chosenSlots = stationRng.randint(1, windowSize);
        const delayUs = chosenSlots * this.slotTimeUs;

        station.state = STATION_STATES.BACKOFF;
        station.backoff_count += 1;
        station.current_backoff_window = windowSize;

        // Next attempt will be scheduled at next slot boundary + (chosenSlots - 1) * slotTime
        const currentSlotEnd = this.getStrictNextSlotBoundary(this.ctx.clock.currentTime);
        const retryTime = currentSlotEnd + (chosenSlots - 1) * this.slotTimeUs;
        station.next_attempt_time = retryTime;

        this.ctx.recordEvent(EVENT_TYPES.BACKOFF_STARTED, station.id, frame.id, {
          attemptNumber: frame.attempt_count,
          delayUs,
          delayMs: delayUs / 1000,
          retryTime,
          chosenSlots,
          windowSize,
          slotTimeUs: this.slotTimeUs,
        });

        this.ctx.eventQueue.push({
          id: `slotted_backoff_${station.id}_${frame.id}_${retryTime}`,
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
            // Transmit at this slot boundary
            this.attemptTransmissionAtSlot(station);
          },
        });
      }
    }
  }

  /**
   * Calculates research and educational slot metrics.
   * Total slots = Idle slots + Successful slots + Collided slots.
   */
  public getProtocolMetrics(): Partial<SimulationMetricsModel> {
    const currentSlotIndex = Math.floor(this.ctx.clock.currentTime / this.slotTimeUs);
    const totalSlots = Math.max(0, currentSlotIndex);
    let successfulSlots = 0;
    let collidedSlots = 0;

    for (const [slotIdx, record] of this.slotRecords.entries()) {
      if (slotIdx < totalSlots) {
        if (record.count === 1 && record.success) {
          successfulSlots += 1;
        } else if (record.count >= 2 || !record.success) {
          collidedSlots += 1;
        }
      }
    }

    const idleSlots = Math.max(0, totalSlots - (successfulSlots + collidedSlots));
    const slotUtilization = totalSlots > 0 ? successfulSlots / totalSlots : 0.0;

    return {
      total_slots: totalSlots,
      idle_slots: idleSlots,
      successful_slots: successfulSlots,
      collided_slots: collidedSlots,
      slot_utilization: slotUtilization,
    };
  }
}
