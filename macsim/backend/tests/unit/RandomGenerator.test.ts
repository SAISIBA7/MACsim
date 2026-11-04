import { describe, it, expect } from 'vitest';
import { RandomGenerator } from '../../src/engine/RandomGenerator.js';

describe('RandomGenerator (Deterministic LCG)', () => {
  it('should produce identical sequences with identical seeds', () => {
    const rng1 = new RandomGenerator(12345);
    const rng2 = new RandomGenerator(12345);

    for (let i = 0; i < 100; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('should produce exponential numbers with correct mean', () => {
    const rng = new RandomGenerator(999);
    const lambda = 10;
    let sum = 0;
    const n = 10000;

    for (let i = 0; i < n; i++) {
      sum += rng.exponential(lambda);
    }

    const sampleMean = sum / n;
    const expectedMean = 1.0 / lambda; // 0.1
    expect(sampleMean).toBeCloseTo(expectedMean, 1);
  });
});

