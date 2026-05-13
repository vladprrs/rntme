import { describe, expect, it, mock, afterEach } from 'bun:test';
import { targetEndpoints, targetEndpointPaths } from '../../../src/api/target-endpoints.js';
import { restoreGlobals, stubGlobal } from '../../helpers/globals.js';

const targetRow = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'prod',
  displayName: 'Production',
  kind: 'dokploy',
  publicBaseUrl: null,
  isDefault: false,
};

const ctx = { baseUrl: 'https://platform.example', token: 'rntme_pat_test' };

describe('target-endpoints path constants', () => {
  it('uses platform blueprint deploy-targets paths', () => {
    expect(targetEndpointPaths.list()).toBe('/api/deployments/targets');
    expect(targetEndpointPaths.show('prod')).toBe('/api/deployments/targets/prod');
    expect(targetEndpointPaths.create()).toBe('/api/deployments/targets');
    expect(targetEndpointPaths.update('prod')).toBe('/api/deployments/targets/prod/actions/update');
    expect(targetEndpointPaths.delete('prod')).toBe('/api/deployments/targets/prod/actions/delete');
  });

  it('does NOT reference any legacy /v1/orgs/.../deploy-targets paths', () => {
    const all = [
      targetEndpointPaths.list(),
      targetEndpointPaths.show('prod'),
      targetEndpointPaths.create(),
      targetEndpointPaths.update('prod'),
      targetEndpointPaths.delete('prod'),
    ];
    for (const p of all) {
      expect(p).not.toContain('/v1/');
      expect(p).not.toContain('/v1/orgs');
      expect(p).not.toContain('deploy-targets');
      expect(p).toContain('/api/deployments/targets');
    }
  });

  it('url-encodes slug segments', () => {
    expect(targetEndpointPaths.show('a/b')).toBe('/api/deployments/targets/a%2Fb');
    expect(targetEndpointPaths.update('weird name')).toBe(
      '/api/deployments/targets/weird%20name/actions/update',
    );
    expect(targetEndpointPaths.delete('weird name')).toBe(
      '/api/deployments/targets/weird%20name/actions/delete',
    );
  });
});

describe('targetEndpoints HTTP calls', () => {
  afterEach(() => {
    restoreGlobals();
    mock.restore();
  });

  it('list — GET with organizationId in querystring', async () => {
    const fetchMock = mock().mockResolvedValue(
      new Response(JSON.stringify({ targets: [targetRow] }), { status: 200 }),
    );
    stubGlobal('fetch', fetchMock);

    const res = await targetEndpoints.list(ctx, 'org-uuid');
    expect(res.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://platform.example/api/deployments/targets?organizationId=org-uuid',
    );
    expect(init.method).toBe('GET');
    expect(url).not.toContain('/v1/');
  });

  it('show — GET on slug path', async () => {
    const fetchMock = mock().mockResolvedValue(
      new Response(JSON.stringify({ target: targetRow }), { status: 200 }),
    );
    stubGlobal('fetch', fetchMock);

    const res = await targetEndpoints.show(ctx, 'org-uuid', 'prod');
    expect(res.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://platform.example/api/deployments/targets/prod');
    expect(init.method).toBe('GET');
    expect(url).not.toContain('/v1/');
  });

  it('create — POST with organizationId in body', async () => {
    const fetchMock = mock().mockResolvedValue(
      new Response(JSON.stringify({ target: targetRow }), { status: 201 }),
    );
    stubGlobal('fetch', fetchMock);

    const res = await targetEndpoints.create(ctx, 'org-uuid', {
      slug: 'prod',
      displayName: 'Production',
      kind: 'dokploy',
    });
    expect(res.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://platform.example/api/deployments/targets');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      organizationId: 'org-uuid',
      slug: 'prod',
      displayName: 'Production',
      kind: 'dokploy',
    });
    expect(url).not.toContain('/v1/');
  });

  it('setConfig — POST to /actions/update with organizationId in body', async () => {
    const fetchMock = mock().mockResolvedValue(
      new Response(JSON.stringify({ target: targetRow }), { status: 200 }),
    );
    stubGlobal('fetch', fetchMock);

    const res = await targetEndpoints.setConfig(ctx, 'org-uuid', 'prod', {
      publicBaseUrl: 'https://prod.example',
    });
    expect(res.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://platform.example/api/deployments/targets/prod/actions/update');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      organizationId: 'org-uuid',
      publicBaseUrl: 'https://prod.example',
    });
    expect(url).not.toContain('/v1/');
  });

  it('delete — POST to /actions/delete with organizationId in body', async () => {
    const fetchMock = mock().mockResolvedValue(
      new Response(JSON.stringify({ target: targetRow }), { status: 200 }),
    );
    stubGlobal('fetch', fetchMock);

    const res = await targetEndpoints.delete(ctx, 'org-uuid', 'prod');
    expect(res.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://platform.example/api/deployments/targets/prod/actions/delete');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ organizationId: 'org-uuid' });
    expect(url).not.toContain('/v1/');
  });
});
