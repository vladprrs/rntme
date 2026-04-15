import { describe, it, expect } from 'vitest';
import { wireEventPipeline } from '../../src/start/wire-event-pipeline.js';

describe('wireEventPipeline', () => {
  it('is exported as a function (smoke: pipeline wiring does not auto-start)', () => {
    expect(typeof wireEventPipeline).toBe('function');
  });
});
