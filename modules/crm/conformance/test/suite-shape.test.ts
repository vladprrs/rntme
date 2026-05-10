import { describe, expect, it } from 'bun:test';
import { suite } from '../src/index.js';

describe('CategoryConformanceSuite shape', () => {
  it('every scenarios entry is an array (non-empty in v1 skeleton)', () => {
    for (const [rpc, scenarios] of Object.entries(suite.scenarios)) {
      expect(Array.isArray(scenarios), `scenarios[${rpc}] must be an array`).toBe(true);
    }
  });

  it('exactly 34 RPCs wired', () => {
    expect(Object.keys(suite.scenarios)).toHaveLength(34);
  });

  it('all scenario arrays contain typed pending fixtures in v1 skeleton (until framework lands)', () => {
    for (const [rpc, scenarios] of Object.entries(suite.scenarios)) {
      expect(scenarios.length, `scenarios[${rpc}] should contain one pending fixture`).toBeGreaterThanOrEqual(1);
      for (const scenario of scenarios) {
        expect(scenario.id, `${rpc} scenario id`).toMatch(new RegExp(`^${rpc}\\.\\w+`));
        expect(scenario.capability).toBe(rpc);
        expect(scenario.status).toBe('pending');
        expect(scenario.assertionsDescription).toContain(rpc);
        expect(scenario.assertionsDescription).not.toContain('See this file docstring');
        expect(scenario.assertionsDescription?.length).toBeGreaterThan(120);
      }
    }
  });
});
