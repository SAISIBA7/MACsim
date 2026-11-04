import { RandomGenerator } from './RandomGenerator.js';
import { BackoffAlgorithm } from '../types/protocol.types.js';

export class BackoffManager {
  private rng: RandomGenerator;
  private slotTimeUs: number;
  private maxExponent: number;
  private maxRetryLimit: number;
  private algorithm: BackoffAlgorithm;

  constructor(
    rng: RandomGenerator,
    slotTimeUs: number = 51.2,
    maxExponent: number = 10,
    maxRetryLimit: number = 16,
    algorithm: BackoffAlgorithm = 'TRUNCATED_BINARY_EXPONENTIAL'
  ) {
    this.rng = rng;
    this.slotTimeUs = slotTimeUs;
    this.maxExponent = maxExponent;
    this.maxRetryLimit = maxRetryLimit;
    this.algorithm = algorithm;
  }

  /**
   * Calculates backoff delay in microseconds given collision retry count n (1-indexed).
   * For n=1: k = min(1, 10) = 1, W = 2^1 = 2, R in [0, 1], delay = R * slotTime.
   * For n=10+: k = 10, W = 1024, R in [0, 1023].
   * If n >= maxRetryLimit (16): exceededMaxRetry = true.
   */
  public calculateBackoff(attemptCount: number): {
    delayUs: number;
    exceededMaxRetry: boolean;
    chosenSlot: number;
    windowSize: number;
  } {
    if (attemptCount >= this.maxRetryLimit) {
      return {
        delayUs: 0,
        exceededMaxRetry: true,
        chosenSlot: 0,
        windowSize: 0,
      };
    }

    let windowSize: number;
    let chosenSlot: number;

    switch (this.algorithm) {
      case 'BINARY_EXPONENTIAL':
      case 'TRUNCATED_BINARY_EXPONENTIAL': {
        const exponent = Math.min(attemptCount, this.maxExponent);
        windowSize = Math.pow(2, exponent); // e.g. 2, 4, 8, ... up to 1024
        chosenSlot = this.rng.randint(0, windowSize - 1);
        break;
      }
      case 'LINEAR': {
        windowSize = Math.min((attemptCount + 1) * 2, Math.pow(2, this.maxExponent));
        chosenSlot = this.rng.randint(0, windowSize - 1);
        break;
      }
      case 'UNIFORM_RANDOM': {
        windowSize = Math.pow(2, Math.min(4, this.maxExponent));
        chosenSlot = this.rng.randint(0, windowSize - 1);
        break;
      }
      case 'CONSTANT':
      default: {
        windowSize = 1;
        chosenSlot = 1;
        break;
      }
    }

    const delayUs = Math.round(chosenSlot * this.slotTimeUs);
    return {
      delayUs,
      exceededMaxRetry: false,
      chosenSlot,
      windowSize,
    };
  }
}
