import { describe, it, expect } from 'vitest';
import { BackoffManager } from '../../src/engine/BackoffManager.js';
import { RandomGenerator } from '../../src/engine/RandomGenerator.js';

describe('BackoffManager (Truncated Binary Exponential Backoff)', () => {
  it('should scale window size exponentially up to max exponent', () => {
    const rng = new RandomGenerator(42);
    const bm = new BackoffManager(rng, 51.2, 10, 16);

    const b1 = bm.calculateBackoff(1);
    expect(b1.windowSize).toBe(2); // 2^1

    const b2 = bm.calculateBackoff(2);
    expect(b2.windowSize).toBe(4); // 2^2

    const b3 = bm.calculateBackoff(3);
    expect(b3.windowSize).toBe(8); // 2^3

    const b12 = bm.calculateBackoff(12);
    expect(b12.windowSize).toBe(1024); // truncated at 2^10
  });

  it('should signal exceededMaxRetry when limit reached', () => {
    const rng = new RandomGenerator(42);
    const bm = new BackoffManager(rng, 51.2, 10, 16);

    const b16 = bm.calculateBackoff(16);
    expect(b16.exceededMaxRetry).toBe(true);
  });
});

