import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { runProjectUpdateOperation } from '../../../../src/commands/project/update-operation.js';
import { runProjectDeleteOperation } from '../../../../src/commands/project/delete-operation.js';
import { runProjectOperationList } from '../../../../src/commands/project/operation-list.js';
import { runProjectOperationShow } from '../../../../src/commands/project/operation-show.js';

const operation = {
  id: '11111111-1111-4111-8111-111111111111',
  orgId: '22222222-2222-4222-8222-222222222222',
  projectId: '33333333-3333-4333-8333-333333333333',
  kind: 'update',
  status: 'queued',
  requestedByAccountId: '44444444-4444-4444-8444-444444444444',
  requestedByTokenId: null,
  targetId: '55555555-5555-4555-8555-555555555555',
  projectVersionId: '66666666-6666-4666-8666-666666666666',
  deploymentId: '77777777-7777-4777-8777-777777777777',
  input: { projectVersionSeq: 4, targetSlug: 'dokploy-demos' },
  result: null,
  errorCode: null,
  errorMessage: null,
  queuedAt: '2026-05-03T12:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  lastHeartbeatAt: null,
};

const deployment = {
  id: '77777777-7777-4777-8777-777777777777',
  orgId: operation.orgId,
  projectId: operation.projectId,
  projectVersionId: operation.projectVersionId,
  projectVersionSeq: 4,
  targetId: operation.targetId,
  targetSlug: 'dokploy-demos',
  status: 'queued',
  configOverrides: {},
  renderedPlanDigest: null,
  applyResult: null,
  verificationReport: null,
  warnings: [],
  errorCode: null,
  errorMessage: null,
  startedByAccountId: operation.requestedByAccountId,
  queuedAt: operation.queuedAt,
  startedAt: null,
  finishedAt: null,
  lastHeartbeatAt: null,
};

const flags = {
  org: 'acme',
  project: 'notes-demo',
  token: 'rntme_pat_test',
  baseUrl: 'https://platform.example',
  json: true,
};

describe('project operation commands', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('queues update operations with explicit version and target', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ operation, deployment }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const exit = await runProjectUpdateOperation({ version: 4, target: 'dokploy-demos' }, flags);

    expect(exit).toBe(0);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://platform.example/v1/orgs/acme/projects/notes-demo/operations/update');
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      projectVersionSeq: 4,
      targetSlug: 'dokploy-demos',
    });
  });

  it('queues delete operations with confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ operation: { ...operation, kind: 'delete', targetId: null, projectVersionId: null, deploymentId: null } }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const exit = await runProjectDeleteOperation({ confirm: 'notes-demo' }, flags);

    expect(exit).toBe(0);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://platform.example/v1/orgs/acme/projects/notes-demo/operations/delete');
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({ confirm: 'notes-demo' });
  });

  it('lists project operations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ operations: [operation] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const exit = await runProjectOperationList({ limit: 10 }, flags);

    expect(exit).toBe(0);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://platform.example/v1/orgs/acme/projects/notes-demo/operations?limit=10');
  });

  it('shows one project operation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ operation }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const exit = await runProjectOperationShow({ operationId: operation.id }, flags);

    expect(exit).toBe(0);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`https://platform.example/v1/orgs/acme/projects/notes-demo/operations/${operation.id}`);
  });
});
