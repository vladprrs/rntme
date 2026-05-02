import { describe, expect, it } from 'vitest';
import { resolveVars, applyVars } from '../../src/vars.js';

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
