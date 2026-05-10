import { describe, expect, it } from 'bun:test';
import { plan } from '../../../src/stages/plan.js';

describe('stages.plan', () => {
  it('exports a plan function', () => {
    expect(typeof plan).toBe('function');
  });
});
