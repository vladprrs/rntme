import { describe, expect, it } from 'vitest';
import { resolveVars, resolveTargetVarsOnly, applyVars } from '../../src/vars.js';

const target = {
  slug: 'demo',
  auth: { auth0: { clientId: 'abc', audience: 'https://api/' } },
  modules: {},
  eventBus: { topicPrefix: 'pfx', brokers: ['k:9092'] },
};

describe('resolveVars', () => {
  it('resolves a known path', () => {
    const r = resolveVars(
      { CID: { from: 'target.auth.auth0.clientId', required: true } },
      target,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ CID: 'abc' });
  });

  it('fails with DEPLOY_PLAN_TARGET_VAR_MISSING when required value missing', () => {
    const r = resolveVars(
      { MISSING: { from: 'target.auth.auth0.tenantId', required: true } },
      target,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('DEPLOY_PLAN_TARGET_VAR_MISSING');
      expect(r.errors[0]!.varName).toBe('MISSING');
      expect(r.errors[0]!.fromPath).toBe('target.auth.auth0.tenantId');
      expect(r.errors[0]!.targetSlug).toBe('demo');
    }
  });

  it('omits optional missing var', () => {
    const r = resolveVars(
      { OPT: { from: 'target.auth.auth0.tenantId', required: false } },
      target,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({});
  });
});

describe('resolveVars provision.* sources', () => {
  const provisionResult = {
    modules: {
      identity: {
        publicOutputs: {
          spaClient: { id: 'spa_abc', name: 'Notes Demo' },
          resourceServer: { id: 'rs_xyz', identifier: 'https://notes-demo.rntme.com/api' },
        },
      },
    },
  };

  const discoveredModules = {
    identity: { producesNames: ['spaClient', 'resourceServer'] },
  };

  it('resolves a provision.<moduleKey>.<output>.<path>', () => {
    const r = resolveVars(
      { AUTH0_SPA_CLIENT_ID: { from: 'provision.identity.spaClient.id', required: true } },
      target,
      { provisionResult, discoveredModules },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.AUTH0_SPA_CLIENT_ID).toBe('spa_abc');
  });

  it('errors with PROVISION_PATH_INVALID for a malformed path', () => {
    const r = resolveVars(
      { BAD: { from: 'provision.identity', required: true } },
      target,
      { provisionResult, discoveredModules },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('BLUEPRINT_VAR_PROVISION_PATH_INVALID');
  });

  it('errors with PROVISION_MODULE_MISSING when discoveredModules lacks the key', () => {
    const r = resolveVars(
      { X: { from: 'provision.unknownModule.foo.bar', required: true } },
      target,
      { provisionResult, discoveredModules },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('BLUEPRINT_VAR_PROVISION_MODULE_MISSING');
  });

  it('errors with PROVISION_OUTPUT_NOT_DECLARED when output not in produces', () => {
    const r = resolveVars(
      { X: { from: 'provision.identity.unknownOutput.id', required: true } },
      target,
      { provisionResult, discoveredModules },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('BLUEPRINT_VAR_PROVISION_OUTPUT_NOT_DECLARED');
  });

  it('errors with PROVISION_OUTPUT_MISSING when provisioner did not run for this module', () => {
    const r = resolveVars(
      { X: { from: 'provision.identity.spaClient.id', required: true } },
      target,
      {
        provisionResult: { modules: {} },
        discoveredModules,
      },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('BLUEPRINT_VAR_PROVISION_OUTPUT_MISSING');
  });

  it('errors with PROVISION_PATH_NOT_FOUND when JSON pointer dead-ends', () => {
    const r = resolveVars(
      { X: { from: 'provision.identity.spaClient.notAField.deeper', required: true } },
      target,
      { provisionResult, discoveredModules },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('BLUEPRINT_VAR_PROVISION_PATH_NOT_FOUND');
  });
});

describe('resolveTargetVarsOnly', () => {
  const targetWithRedirect = {
    slug: 'demo',
    auth: {
      auth0: {
        clientId: 'abc',
        audience: 'https://api/',
        redirectUri: 'https://demo.example/',
      },
    },
  };

  it('resolves target.* bindings and skips provision.* bindings', () => {
    const r = resolveTargetVarsOnly(
      {
        REDIRECT: { from: 'target.auth.auth0.redirectUri', required: true },
        SPA_ID: { from: 'provision.identity.spaClient.id', required: true },
      },
      targetWithRedirect,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ REDIRECT: 'https://demo.example/' });
  });

  it('errors when a required target.* binding is missing on the target', () => {
    const r = resolveTargetVarsOnly(
      { DOMAIN: { from: 'target.auth.auth0.domain', required: true } },
      targetWithRedirect,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('DEPLOY_PLAN_TARGET_VAR_MISSING');
  });

  it('returns empty object when manifest contains only provision.* bindings', () => {
    const r = resolveTargetVarsOnly(
      { SPA_ID: { from: 'provision.identity.spaClient.id', required: true } },
      targetWithRedirect,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({});
  });

  it('substituted value flows through applyVars into nested publicConfig', () => {
    const r = resolveTargetVarsOnly(
      { REDIRECT: { from: 'target.auth.auth0.redirectUri', required: true } },
      targetWithRedirect,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const publicConfig = { redirectUri: '${REDIRECT}', clientId: '${SPA_ID}' };
      expect(applyVars(publicConfig, r.value)).toEqual({
        redirectUri: 'https://demo.example/',
        clientId: '${SPA_ID}',
      });
    }
  });
});

describe('applyVars', () => {
  it('substitutes ${VAR} in strings', () => {
    expect(applyVars('hello ${X}', { X: 'world' })).toBe('hello world');
  });

  it('walks nested objects and arrays', () => {
    expect(
      applyVars(
        { a: '${X}', b: ['${Y}', { c: '${X}' }] },
        { X: '1', Y: '2' },
      ),
    ).toEqual({ a: '1', b: ['2', { c: '1' }] });
  });

  it('leaves missing placeholders intact', () => {
    expect(applyVars('${X}/${Y}', { X: '1' })).toBe('1/${Y}');
  });
});
