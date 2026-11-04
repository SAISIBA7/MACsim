export interface ActiveTransmission {
  stationId: string;
  frameId: string;
  startTime: number; // in microseconds
  endTime: number;   // in microseconds
  isCollided: boolean;
  collidedWith: string[];
  collisionIncidentId?: string;
}

export interface CollisionIncident {
  id: string;
  timestamp: number;
  participatingStationIds: string[];
  participatingFrameIds: string[];
}

export class SharedMedium {
  private activeTransmissions: Map<string, ActiveTransmission> = new Map();
  private propagationDelayUs: number;

  // Collision tracking: distinguish collision incidents (channel events) from collided attempts (per-station)
  private totalCollisionIncidents: number = 0;
  private totalCollidedAttempts: number = 0;
  private activeCollisionIncidentId: string | null = null;
  private activeCollisionFrames: Set<string> = new Set();

  // Channel utilization metrics
  private lastStateChangeTime: number = 0;
  private currentActiveCount: number = 0;
  private busyTimeUs: number = 0;
  private collisionTimeUs: number = 0;
  private idleTimeUs: number = 0;
  private successfulTimeUs: number = 0;

  constructor(propagationDelayUs: number = 5.0) {
    this.propagationDelayUs = Math.max(0, propagationDelayUs);
  }

  public get propagationDelay(): number {
    return this.propagationDelayUs;
  }

  public getActiveCount(): number {
    return this.activeTransmissions.size;
  }

  public getActiveTransmissions(): ActiveTransmission[] {
    return Array.from(this.activeTransmissions.values());
  }

  public getCollisionStats(): { incidents: number; attempts: number } {
    return {
      incidents: this.totalCollisionIncidents,
      attempts: this.totalCollidedAttempts,
    };
  }

  public getCollisionIncidents(): number {
    return this.totalCollisionIncidents;
  }

  /**
   * Carrier sensing at time t for station stationId.
   * Takes into account signal propagation delay tau:
   * Signal from station K started at t_s reaches stationId at t_s + tau,
   * and ends at t_e + tau.
   */
  public isCarrierSensedBusy(currentTime: number, stationId?: string): boolean {
    for (const tx of this.activeTransmissions.values()) {
      if (stationId && tx.stationId === stationId) {
        continue; // A station does not carrier-sense its own transmission
      }

      // Signal reaches other stations after propagation delay
      const arrivalAtReceiver = tx.startTime + this.propagationDelayUs;
      const endAtReceiver = tx.endTime + this.propagationDelayUs;

      if (currentTime >= arrivalAtReceiver && currentTime <= endAtReceiver) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks whether ANY signal energy is present on the channel at time t.
   */
  public isChannelBusy(currentTime: number): boolean {
    for (const tx of this.activeTransmissions.values()) {
      const channelEnd = tx.endTime + this.propagationDelayUs;
      if (currentTime >= tx.startTime && currentTime <= channelEnd) {
        return true;
      }
    }
    return false;
  }

  /**
   * Update channel utilization counters based on elapsed simulation time.
   */
  public updateTime(currentTime: number): void {
    const elapsed = Math.round(currentTime - this.lastStateChangeTime);
    if (elapsed > 0) {
      if (this.currentActiveCount === 0) {
        this.idleTimeUs += elapsed;
      } else if (this.currentActiveCount === 1) {
        // If the single active transmission was marked collided from an earlier overlap
        const onlyTx = this.activeTransmissions.values().next().value;
        if (onlyTx && onlyTx.isCollided) {
          this.collisionTimeUs += elapsed;
          this.busyTimeUs += elapsed;
        } else {
          this.busyTimeUs += elapsed;
          this.successfulTimeUs += elapsed;
        }
      } else {
        // Two or more active transmissions -> collision interval
        this.collisionTimeUs += elapsed;
        this.busyTimeUs += elapsed;
      }
      this.lastStateChangeTime = Math.round(currentTime);
    }
  }

  /**
   * Station begins transmitting a frame on the medium.
   * Evaluates collision with existing transmissions on the medium.
   */
  public startTransmission(
    stationId: string,
    frameId: string,
    startTime: number,
    endTime: number
  ): {
    isCollision: boolean;
    isNewIncident: boolean;
    incidentId: string | null;
    collidedTransmissions: ActiveTransmission[];
  } {
    this.updateTime(startTime);

    const newTx: ActiveTransmission = {
      stationId,
      frameId,
      startTime: Math.round(startTime),
      endTime: Math.round(endTime),
      isCollided: false,
      collidedWith: [],
    };

    const collided: ActiveTransmission[] = [];
    let isNewIncident = false;

    // Check overlap with every currently active transmission on the medium
    for (const existingTx of this.activeTransmissions.values()) {
      // Signals overlap if newTx starts before existingTx propagation ends
      // and existingTx starts before newTx propagation ends
      const existingEndWithProp = existingTx.endTime + this.propagationDelayUs;
      const newStart = newTx.startTime;

      if (newStart < existingEndWithProp) {
        // Overlap detected!
        if (!existingTx.isCollided) {
          existingTx.isCollided = true;
          this.totalCollidedAttempts += 1;
        }
        existingTx.collidedWith.push(frameId);

        if (!newTx.isCollided) {
          newTx.isCollided = true;
          this.totalCollidedAttempts += 1;
        }
        newTx.collidedWith.push(existingTx.frameId);

        collided.push(existingTx);
      }
    }

    if (newTx.isCollided) {
      collided.push(newTx);

      // Manage collision incident
      if (!this.activeCollisionIncidentId) {
        this.totalCollisionIncidents += 1;
        this.activeCollisionIncidentId = `incident_${this.totalCollisionIncidents}`;
        this.activeCollisionFrames.clear();
        isNewIncident = true;
      }

      newTx.collisionIncidentId = this.activeCollisionIncidentId;
      this.activeCollisionFrames.add(frameId);

      for (const c of collided) {
        c.collisionIncidentId = this.activeCollisionIncidentId;
        this.activeCollisionFrames.add(c.frameId);
      }
    }

    this.activeTransmissions.set(frameId, newTx);
    this.currentActiveCount = this.activeTransmissions.size;

    return {
      isCollision: newTx.isCollided,
      isNewIncident,
      incidentId: newTx.collisionIncidentId ?? null,
      collidedTransmissions: collided,
    };
  }

  /**
   * Station completes or aborts transmission on the medium.
   */
  public endTransmission(frameId: string, currentTime: number): ActiveTransmission | undefined {
    this.updateTime(currentTime);
    const tx = this.activeTransmissions.get(frameId);
    if (tx) {
      this.activeTransmissions.delete(frameId);
      this.currentActiveCount = this.activeTransmissions.size;

      if (this.activeCollisionFrames.has(frameId)) {
        this.activeCollisionFrames.delete(frameId);
        if (this.activeCollisionFrames.size === 0) {
          this.activeCollisionIncidentId = null;
        }
      }
    }
    return tx;
  }

  public getChannelTimes(currentTime: number): {
    busyTimeUs: number;
    collisionTimeUs: number;
    idleTimeUs: number;
    successfulTimeUs: number;
  } {
    this.updateTime(currentTime);
    return {
      busyTimeUs: this.busyTimeUs,
      collisionTimeUs: this.collisionTimeUs,
      idleTimeUs: this.idleTimeUs,
      successfulTimeUs: this.successfulTimeUs,
    };
  }

  public reset(): void {
    this.activeTransmissions.clear();
    this.totalCollisionIncidents = 0;
    this.totalCollidedAttempts = 0;
    this.activeCollisionIncidentId = null;
    this.activeCollisionFrames.clear();
    this.lastStateChangeTime = 0;
    this.currentActiveCount = 0;
    this.busyTimeUs = 0;
    this.collisionTimeUs = 0;
    this.idleTimeUs = 0;
    this.successfulTimeUs = 0;
  }
}
