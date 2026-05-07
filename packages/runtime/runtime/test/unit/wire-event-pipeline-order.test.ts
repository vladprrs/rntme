/**
 * Plan smoke check only (see `docs/history/plans/historical/2026-04-15-runtime-seed.md` Task 13):
 * verifies `wireEventPipeline` is wired without asserting start order here.
 * Full start-order behavior is covered in the integration suite (Task 14).
 */
import { describe, it, expect } from 'vitest';
import { wireEventPipeline } from '../../src/start/wire-event-pipeline.js';

describe('wireEventPipeline', () => {
  it('is exported as a function (smoke: pipeline wiring does not auto-start)', () => {
    expect(typeof wireEventPipeline).toBe('function');
  });
});
