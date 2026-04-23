export type CircuitState = 'closed' | 'open' | 'half-open';

export type CircuitBreakerOptions = {
  windowMs: number;
  minCalls: number;
  errorRateThreshold: number;  // e.g. 0.5
  halfOpenAfterMs: number;
  /** Injectable clock for testing. */
  now?: () => number;
};

type Sample = { time: number; ok: boolean };

export class CircuitBreaker {
  private samples: Sample[] = [];
  private currentState: CircuitState = 'closed';
  private openedAt = 0;
  private readonly opts: CircuitBreakerOptions;

  constructor(opts: CircuitBreakerOptions) {
    this.opts = opts;
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private prune(): void {
    const cutoff = this.now() - this.opts.windowMs;
    this.samples = this.samples.filter((s) => s.time >= cutoff);
  }

  private maybeOpen(): void {
    this.prune();
    if (this.samples.length < this.opts.minCalls) return;
    const failures = this.samples.filter((s) => !s.ok).length;
    const rate = failures / this.samples.length;
    if (rate >= this.opts.errorRateThreshold) {
      this.currentState = 'open';
      this.openedAt = this.now();
    }
  }

  onSuccess(): void {
    if (this.currentState === 'half-open') {
      this.currentState = 'closed';
      this.samples = [];
      return;
    }
    this.samples.push({ time: this.now(), ok: true });
    this.maybeOpen();
  }

  onFailure(): void {
    if (this.currentState === 'half-open') {
      this.currentState = 'open';
      this.openedAt = this.now();
      return;
    }
    this.samples.push({ time: this.now(), ok: false });
    this.maybeOpen();
  }

  allow(): boolean {
    if (this.currentState === 'closed') return true;
    if (this.currentState === 'half-open') return false; // only one concurrent probe — allow() returned true once already
    // open: check half-open transition
    if (this.now() - this.openedAt >= this.opts.halfOpenAfterMs) {
      this.currentState = 'half-open';
      return true;
    }
    return false;
  }

  state(): CircuitState {
    return this.currentState;
  }
}
