import { describe, expect, it } from 'vitest';
import { parseProjectBlueprint } from '../../src/parse/parse.js';

describe('parseProjectBlueprint', () => {
  it('parses minimal project.json shape', () => {
    const r = parseProjectBlueprint({
      name: 'commerce-catalog',
      services: ['catalog', 'app', 'mod-workos'],
    });
    expect(r.ok).toBe(true);
  });
});
