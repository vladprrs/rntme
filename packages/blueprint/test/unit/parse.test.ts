import { describe, expect, it } from 'vitest';
import { parseProjectBlueprint } from '../../src/parse/parse.js';
import { ServiceDescriptorSchema } from '../../src/parse/schema.js';

describe('parseProjectBlueprint', () => {
  it('parses minimal project.json shape', () => {
    const r = parseProjectBlueprint({
      name: 'commerce-catalog',
      services: ['catalog', 'app', 'mod-workos'],
    });
    expect(r.ok).toBe(true);
  });

  it('parses integration-module service descriptors', () => {
    const r = ServiceDescriptorSchema.safeParse({ kind: 'integration-module' });
    expect(r.success).toBe(true);
  });
});
