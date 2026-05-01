import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker } from '../../src/plugins/adapter-client/circuit-breaker.js';

describe('CircuitBreaker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stays closed while error rate < threshold', () => {
    const cb = new CircuitBreaker({ windowMs: 30_000, minCalls: 4, errorRateThreshold: 0.5, halfOpenAfterMs: 30_000 });
    cb.onSuccess(); cb.onSuccess(); cb.onFailure(); cb.onSuccess();
    expect(cb.state()).toBe('closed');
    expect(cb.allow()).toBe(true);
  });

  it('opens after errorRate >= threshold in window', () => {
    const cb = new CircuitBreaker({ windowMs: 30_000, minCalls: 4, errorRateThreshold: 0.5, halfOpenAfterMs: 30_000 });
    cb.onFailure(); cb.onFailure(); cb.onFailure(); cb.onSuccess();
    expect(cb.state()).toBe('open');
    expect(cb.allow()).toBe(false);
  });

  it('transitions to half-open after halfOpenAfterMs', () => {
    const cb = new CircuitBreaker({ windowMs: 30_000, minCalls: 2, errorRateThreshold: 0.5, halfOpenAfterMs: 30_000 });
    cb.onFailure(); cb.onFailure();
    expect(cb.state()).toBe('open');
    vi.advanceTimersByTime(30_000);
    expect(cb.allow()).toBe(true); // single probe
    expect(cb.state()).toBe('half-open');
  });

  it('closes after a successful half-open probe', () => {
    const cb = new CircuitBreaker({ windowMs: 30_000, minCalls: 2, errorRateThreshold: 0.5, halfOpenAfterMs: 30_000 });
    cb.onFailure(); cb.onFailure();
    vi.advanceTimersByTime(30_000);
    cb.allow();
    cb.onSuccess();
    expect(cb.state()).toBe('closed');
  });

  it('re-opens after a failed half-open probe', () => {
    const cb = new CircuitBreaker({ windowMs: 30_000, minCalls: 2, errorRateThreshold: 0.5, halfOpenAfterMs: 30_000 });
    cb.onFailure(); cb.onFailure();
    vi.advanceTimersByTime(30_000);
    cb.allow();
    cb.onFailure();
    expect(cb.state()).toBe('open');
  });
});
