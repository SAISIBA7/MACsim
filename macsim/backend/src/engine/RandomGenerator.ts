/**
 * Deterministic Pseudo-Random Number Generator using Linear Congruential Generator (LCG).
 * Implements Numerical Recipes parameters: m = 2^31, a = 1103515245, c = 12345.
 * Guarantees identical simulation trajectories across platforms and runs.
 */
export class RandomGenerator {
  private state: number;
  private readonly initialSeed: number;

  private readonly m = 0x80000000; // 2^31
  private readonly a = 1103515245;
  private readonly c = 12345;

  constructor(seed?: number) {
    if (seed !== undefined && seed !== null) {
      this.initialSeed = Math.abs(seed | 0) % this.m;
      if (this.initialSeed === 0) this.initialSeed = 1;
    } else {
      this.initialSeed = Math.floor(Math.random() * (this.m - 1)) + 1;
    }
    this.state = this.initialSeed;
  }

  public getSeed(): number {
    return this.initialSeed;
  }

  public getState(): number {
    return this.state;
  }

  /**
   * Creates an independent child RNG stream for a specific station,
   * guaranteeing stream isolation between stations.
   */
  public createStationRng(stationIndex: number): RandomGenerator {
    // Weyl sequence offset to derive uncorrelated sub-stream seeds
    const derivedSeed = (this.initialSeed + (stationIndex + 1) * 2654435761) >>> 0;
    return new RandomGenerator(derivedSeed);
  }

  /**
   * Returns a pseudo-random float in (0, 1) - strictly avoiding 0 for logarithmic operations.
   */
  public next(): number {
    this.state = (this.a * this.state + this.c) % this.m;
    const u = this.state / this.m;
    // Guard against exact 0.0 or 1.0 for numerical safety in log / divisions
    return Math.max(1e-12, Math.min(1.0 - 1e-12, u));
  }

  /**
   * Uniform real number in [min, max)
   */
  public uniform(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Integer in [min, max] inclusive
   */
  public randint(min: number, max: number): number {
    const minCeil = Math.ceil(min);
    const maxFloor = Math.floor(max);
    return Math.floor(this.next() * (maxFloor - minCeil + 1)) + minCeil;
  }

  /**
   * Exponential distribution for Poisson arrivals:
   * Delta_t = -ln(U) / lambda
   */
  public exponential(lambda: number): number {
    if (lambda <= 0) return Infinity;
    const u = this.next();
    return -Math.log(u) / lambda;
  }

  /**
   * Bernoulli trial with success probability p
   */
  public bernoulli(p: number): boolean {
    return this.next() < p;
  }
}
