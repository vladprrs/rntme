/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { createUiDriver } from '../../src/client/driver.js';
import { createStateStore } from '../../src/client/state-store.js';
import { artifact } from '../fixtures/validated-artifact.js';
import type { ValidatedUiArtifact } from '@rntme/ui-legacy';

// Extend fixture with a dataset on /a
const withDataset = JSON.parse(JSON.stringify(artifact));
withDataset.routes['/a'].data = { issuesList: { binding: 'listIssues', refetchOn: ['mount'] } };

const HTTP = {
  listIssues: { method: 'GET' as const, path: '/v1/issues' },
};

describe('driver.query', () => {
  it('fetches the dataset on route enter and writes to /data/<id>', async () => {
    const store = createStateStore();
    const fetchMock = vi.fn(async (_: RequestInfo | URL) =>
      new Response(JSON.stringify([{ id: 1 }, { id: 2 }]), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const driver = createUiDriver({
      artifact: withDataset as ValidatedUiArtifact,
      bindingsHttpBaseUrl: '',
      fetch: fetchMock as unknown as typeof fetch,
      stateStore: store,
      bindingHttpByName: HTTP,
    });
    driver.enterRoute('/a');
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(store.get('/data/issuesList')).toEqual([{ id: 1 }, { id: 2 }]);
    expect(store.get('/data/__status/issuesList')).toBe('success');
  });

  it('reflects 4xx as error status and keeps the dataset empty', async () => {
    const store = createStateStore();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ code: 'BAD', message: 'nope' }), { status: 400, headers: { 'content-type': 'application/json' } }),
    );
    const driver = createUiDriver({
      artifact: withDataset as ValidatedUiArtifact,
      bindingsHttpBaseUrl: '',
      fetch: fetchMock as unknown as typeof fetch,
      stateStore: store,
      bindingHttpByName: HTTP,
    });
    driver.enterRoute('/a');
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(store.get('/data/__status/issuesList')).toBe('error');
    expect(store.get('/data/__error/issuesList')).toMatchObject({ httpStatus: 400 });
  });
});
