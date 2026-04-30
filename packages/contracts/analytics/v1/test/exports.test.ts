import { describe, expect, it } from 'vitest';
import { analyticsV1Operations } from '../src/index.js';

describe('contracts-analytics-v1', () => {
  it('lists canonical operations', () => {
    expect(analyticsV1Operations).toContain('track');
    expect(analyticsV1Operations).toContain('identify');
  });
});
