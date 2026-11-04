/**
 * SimulationClock: Manages discrete simulation time with microsecond integer representation.
 * Prevents cumulative floating-point timing errors and ensures deterministic event scheduling.
 */
export class SimulationClock {
  // Store time internally as integer microseconds (scaled by 1000 for nanosecond internal resolution if needed)
  private _currentTimeUs: number = 0;

  constructor(initialTimeUs: number = 0) {
    this._currentTimeUs = Math.max(0, Math.round(initialTimeUs));
  }

  public get currentTime(): number {
    return this._currentTimeUs;
  }

  public get currentTimeUs(): number {
    return this._currentTimeUs;
  }

  public get currentTimeMs(): number {
    return this._currentTimeUs / 1000;
  }

  public advanceTo(targetTimeUs: number): void {
    const roundedTarget = Math.round(targetTimeUs);
    if (roundedTarget < this._currentTimeUs) {
      throw new Error(
        `Cannot rewind simulation time from ${this._currentTimeUs} us backwards to ${roundedTarget} us.`
      );
    }
    this._currentTimeUs = roundedTarget;
  }

  public reset(): void {
    this._currentTimeUs = 0;
  }
}
