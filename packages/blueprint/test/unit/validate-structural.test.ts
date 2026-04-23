import { describe, expect, it } from 'vitest';
import { validateBlueprintStructural } from '../../src/validate/structural.js';

describe('validateBlueprintStructural', () => {
  it('rejects mod-* slug with domain kind', () => {
    const r = validateBlueprintStructural({
      project: { name: 'commerce', services: ['mod-workos'] },
      serviceDirs: ['mod-workos'],
      services: {
        'mod-workos': { slug: 'mod-workos', kind: 'domain' },
      },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(
        r.errors.some((e) => e.code === 'BLUEPRINT_STRUCT_MOD_KIND_MISMATCH'),
      ).toBe(true);
    }
  });
});
