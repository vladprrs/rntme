import { describe, expect, it } from 'bun:test';
import { validateBlueprintStructural } from '../../src/validate/structural.js';
import { validateBlueprintComposition } from '../../src/validate/composition.js';

const baseInput = {
  serviceDirs: ['app'],
  services: { app: { slug: 'app', kind: 'domain' as const } },
};

describe('structural vars', () => {
  it('rejects vars.from with unknown root', () => {
    const r = validateBlueprintStructural({
      ...baseInput,
      project: {
        name: 'demo',
        services: ['app'],
        vars: { FOO: { from: 'project.junk.path', required: true } },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('BLUEPRINT_VARS_FROM_UNKNOWN_ROOT');
      expect(r.errors[0]!.path).toBe('project.vars.FOO.from');
    }
  });

  it('accepts vars with known root', () => {
    const r = validateBlueprintStructural({
      ...baseInput,
      project: {
        name: 'demo',
        services: ['app'],
        vars: { CID: { from: 'target.auth.auth0.clientId', required: true } },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('accepts vars.from with provision.<moduleKey>.<output>.<jsonPointer>', () => {
    const r = validateBlueprintStructural({
      ...baseInput,
      project: {
        name: 'demo',
        services: ['app'],
        vars: {
          AUTH0_SPA_CLIENT_ID: {
            from: 'provision.identity.spaClient.id',
            required: true,
          },
        },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('accepts vars.from with provision.<moduleKey>.<output> (minimum 3 segments)', () => {
    const r = validateBlueprintStructural({
      ...baseInput,
      project: {
        name: 'demo',
        services: ['app'],
        vars: {
          SPA_CLIENT: { from: 'provision.identity.spaClient', required: true },
        },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects vars.from with provision.<moduleKey> only (no output segment)', () => {
    const r = validateBlueprintStructural({
      ...baseInput,
      project: {
        name: 'demo',
        services: ['app'],
        vars: { X: { from: 'provision.identity', required: true } },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('BLUEPRINT_VARS_FROM_UNKNOWN_ROOT');
      expect(r.errors[0]!.message).toContain('provision.<moduleKey>.<output>');
    }
  });

  it('rejects vars.from with bare "provision"', () => {
    const r = validateBlueprintStructural({
      ...baseInput,
      project: {
        name: 'demo',
        services: ['app'],
        vars: { X: { from: 'provision', required: true } },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('BLUEPRINT_VARS_FROM_UNKNOWN_ROOT');
    }
  });

  it('rejects vars.from with "provisioning.*" typo (not exact provision prefix)', () => {
    const r = validateBlueprintStructural({
      ...baseInput,
      project: {
        name: 'demo',
        services: ['app'],
        vars: { X: { from: 'provisioning.foo.bar', required: true } },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('BLUEPRINT_VARS_FROM_UNKNOWN_ROOT');
    }
  });
});

const composeBase = {
  services: {
    app: {
      slug: 'app',
      kind: 'domain' as const,
      qsm: null,
      artifacts: {
        hasBindings: true,
        hasUi: true,
        hasGraphs: true,
        hasQsm: true,
        hasSeed: false,
        hasStorage: false,
        hasCommandHandlers: false,
      },
    },
  },
};

describe('consistency vars', () => {
  it('rejects placeholder not declared in vars', () => {
    const r = validateBlueprintComposition({
      ...composeBase,
      project: {
        name: 'demo',
        services: ['app'],
        modules: { id: { package: 'mod-x', publicConfig: { key: '${UNDECLARED}' } } },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'BLUEPRINT_CONSISTENCY_VAR_UNDECLARED')).toBe(true);
    }
  });

  it('rejects placeholder in middleware audience not declared in vars', () => {
    const r = validateBlueprintComposition({
      ...composeBase,
      project: {
        name: 'demo',
        services: ['app'],
        middleware: {
          auth: {
            kind: 'auth',
            provider: 'auth0',
            audience: '${MISSING}',
            moduleSlug: 'identity-auth0',
          },
        },
        vars: {},
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'BLUEPRINT_CONSISTENCY_VAR_UNDECLARED')).toBe(true);
    }
  });

  it('rejects vars entry never referenced', () => {
    const r = validateBlueprintComposition({
      ...composeBase,
      project: {
        name: 'demo',
        services: ['app'],
        vars: { UNUSED: { from: 'target.auth.auth0.clientId', required: true } },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'BLUEPRINT_CONSISTENCY_VAR_UNUSED')).toBe(true);
    }
  });

  it('accepts placeholder declared in vars and used by middleware audience', () => {
    const r = validateBlueprintComposition({
      services: {
        ...composeBase.services,
        'identity-auth0': {
          slug: 'identity-auth0',
          kind: 'integration-module' as const,
          qsm: null,
          artifacts: {
            hasBindings: false,
            hasUi: false,
            hasGraphs: false,
            hasQsm: false,
            hasSeed: false,
            hasStorage: false,
            hasCommandHandlers: false,
          },
        },
      },
      project: {
        name: 'demo',
        services: ['app', 'identity-auth0'],
        middleware: {
          auth: {
            kind: 'auth',
            provider: 'auth0',
            audience: '${AUD}',
            moduleSlug: 'identity-auth0',
          },
        },
        vars: { AUD: { from: 'target.auth.auth0.audience', required: true } },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('accepts placeholder declared in vars', () => {
    const r = validateBlueprintComposition({
      ...composeBase,
      project: {
        name: 'demo',
        services: ['app'],
        vars: { K: { from: 'target.auth.auth0.clientId', required: true } },
        modules: { id: { package: 'mod-x', publicConfig: { key: '${K}' } } },
      },
    });
    expect(r.ok).toBe(true);
  });
});
