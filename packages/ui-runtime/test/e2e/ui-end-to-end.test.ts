/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { createUiApp } from '../../src/server/index.js';
import { createUiDriver } from '../../src/client/driver.js';
import { createStateStore } from '../../src/client/state-store.js';
import { artifact as baseArtifact } from '../fixtures/validated-artifact.js';
import type { ValidatedUiArtifact } from '@rntme/ui';

function buildTestApp() {
  const app = new Hono();
  // Fake bindings-http sub-router
  const rows = [{ id: 1, title: 'seed' }];
  app.get('/v1/issues', (c) => c.json(rows));
  app.post('/v1/issues', async (c) => {
    const body = await c.req.json<{ title: string }>();
    rows.push({ id: rows.length + 1, title: body.title });
    return c.json({ version: rows.length });
  });

  const uiArtifact = JSON.parse(JSON.stringify(baseArtifact)) as ValidatedUiArtifact;
  const route = uiArtifact.routes['/a'];
  if (route) {
    route.data = { issuesList: { binding: 'listIssues', refetchOn: ['mount'] } };
    route.actions = {
      submit: {
        kind: 'command',
        binding: 'reportIssue',
        paramsFromState: { title: '/form/title' },
        onSuccess: { clearFormState: ['/form'], refetchData: ['issuesList'] },
      },
    };
  }

  app.route('/', createUiApp({ artifact: uiArtifact, assetsDir: '/nonexistent' }));
  return { app, uiArtifact };
}

describe('ui-runtime E2E (driver against real Hono bindings)', () => {
  it('lists, submits, and refetches end-to-end', async () => {
    const { app, uiArtifact } = buildTestApp();
    const fetchViaApp: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
      app.request(input.toString(), init)) as unknown as typeof fetch;

    const store = createStateStore();
    const driver = createUiDriver({
      artifact: uiArtifact,
      bindingsHttpBaseUrl: '',
      fetch: fetchViaApp,
      stateStore: store,
      bindingHttpByName: {
        listIssues: { method: 'GET', path: '/v1/issues' },
        reportIssue: { method: 'POST', path: '/v1/issues' },
      },
    });

    driver.enterRoute('/a');
    await vi.waitFor(() => expect(store.get('/data/__status/issuesList')).toBe('success'));
    expect((store.get('/data/issuesList') as unknown[]).length).toBe(1);

    store.set('/form/title', 'second');
    await driver.invokeAction('/a', 'submit');
    expect(store.get('/actions/__status/submit')).toBe('success');
    expect(store.get('/form')).toBeUndefined();

    await vi.waitFor(() => expect((store.get('/data/issuesList') as unknown[]).length).toBe(2));
  });
});
