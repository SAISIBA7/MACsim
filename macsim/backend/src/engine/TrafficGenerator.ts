import { RandomGenerator } from './RandomGenerator.js';
import { TrafficDistribution } from '../types/protocol.types.js';

export class TrafficGenerator {
  private rng: RandomGenerator;
  private distribution: TrafficDistribution;
  private lambda: number; // frames per second

  constructor(rng: RandomGenerator, lambda: number, distribution: TrafficDistribution = 'POISSON') {
    this.rng = rng;
    this.lambda = Math.max(0.0001, lambda);
    this.distribution = distribution;
  }

  /**
   * Generates the next inter-arrival interval in integer microseconds.
   * Multiplier adjusts individual station arrival rate (default 1.0).
   */
  public nextIntervalUs(multiplier: number = 1.0): number {
    const effectiveLambda = this.lambda * Math.max(0.001, multiplier);

    switch (this.distribution) {
      case 'POISSON': {
        // Delta_t = -ln(U) / lambda (in seconds) -> microseconds
        const intervalSec = this.rng.exponential(effectiveLambda);
        return Math.max(1, Math.round(intervalSec * 1_000_000));
      }
      case 'UNIFORM': {
        const meanSec = 1.0 / effectiveLambda;
        // Symmetric uniform interval [0.5 * mean, 1.5 * mean]
        const intervalSec = this.rng.uniform(0.5 * meanSec, 1.5 * meanSec);
        return Math.max(1, Math.round(intervalSec * 1_000_000));
      }
      case 'CONSTANT': {
        const meanUs = (1.0 / effectiveLambda) * 1_000_000;
        return Math.max(1, Math.round(meanUs));
      }
      case 'BURST': {
        const meanSec = 1.0 / effectiveLambda;
        // 80% chance of short gap (burst of frames), 20% chance of longer inter-burst silence
        if (this.rng.bernoulli(0.8)) {
          return Math.max(1, Math.round(this.rng.uniform(0.1 * meanSec, 0.3 * meanSec) * 1_000_000));
        } else {
          return Math.max(1, Math.round(this.rng.uniform(2.0 * meanSec, 4.0 * meanSec) * 1_000_000));
        }
      }
      default: {
        const intervalSec = this.rng.exponential(effectiveLambda);
        return Math.max(1, Math.round(intervalSec * 1_000_000));
      }
    }
  }
}
