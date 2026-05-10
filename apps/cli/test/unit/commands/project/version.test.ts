import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test';
import { runProjectVersionList } from '../../../../src/commands/project/version-list.js';
import { runProjectVersionShow } from '../../../../src/commands/project/version-show.js';
import { restoreGlobals, stubGlobal } from '../../../helpers/globals.js';

const version = {
  id: '11111111-1111-4111-8111-111111111111',
  orgId: '22222222-2222-4222-8222-222222222222',
  projectId: '33333333-3333-4333-8333-333333333333',
  seq: 3,
  bundleDigest: 'sha256:' + 'b'.repeat(64),
  bundleBlobKey: 'project-versions/demo/3.json',
  bundleSizeBytes: 456,
  summary: {
    projectName: 'demo',
    services: ['app'],
    routes: { ui: {}, http: {} },
    middleware: {},
    mounts: [],
  },
  uploadedByAccountId: '44444444-4444-4444-8444-444444444444',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('project version commands', () => {
  beforeEach(() => {
    mock.restore();
    restoreGlobals();
  });

  afterEach(() => {
    restoreGlobals();
  });

  it('lists project versions from the project-version endpoint', async () => {
    const fetchMock = mock().mockResolvedValue(new Response(JSON.stringify({ versions: [version], nextCursor: null }), { status: 200 }));
    stubGlobal('fetch', fetchMock);

    const exit = await runProjectVersionList({ limit: 10 }, {
      org: 'acme',
      project: 'demo',
      token: 'rntme_pat_test',
      baseUrl: 'https://platform.example',
      json: true,
    });

    expect(exit).toBe(0);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://platform.example/api/projects/demo/versions?limit=10');
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('/v1/');
  });

  it('shows a project version by sequence number', async () => {
    const fetchMock = mock().mockResolvedValue(new Response(JSON.stringify({ version }), { status: 200 }));
    stubGlobal('fetch', fetchMock);

    const exit = await runProjectVersionShow({ seq: 3 }, {
      org: 'acme',
      project: 'demo',
      token: 'rntme_pat_test',
      baseUrl: 'https://platform.example',
      json: true,
    });

    expect(exit).toBe(0);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://platform.example/v1/orgs/acme/projects/demo/versions/3');
  });
});
