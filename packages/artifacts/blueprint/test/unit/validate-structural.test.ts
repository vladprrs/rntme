import { describe, expect, it } from 'bun:test';
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

  it('allows identity module service slugs with integration-module kind', () => {
    const r = validateBlueprintStructural({
      project: { name: 'notes-demo', services: ['app', 'identity-auth0'] },
      serviceDirs: ['app', 'identity-auth0'],
      services: {
        app: { slug: 'app', kind: 'domain' },
        'identity-auth0': { slug: 'identity-auth0', kind: 'integration-module' },
      },
    });

    expect(r.ok).toBe(true);
  });
});
