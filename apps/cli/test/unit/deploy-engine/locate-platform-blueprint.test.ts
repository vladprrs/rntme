import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { locatePlatformBlueprint } from '../../../src/deploy-engine/locate-platform-blueprint.js';

describe('locatePlatformBlueprint', () => {
  it('returns a path to a bundled directory containing project.json after build', () => {
    const result = locatePlatformBlueprint();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(existsSync(`${result.value}/project.json`)).toBe(true);
    }
  });
});
