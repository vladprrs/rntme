/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { createUiDriver } from '../../src/client/driver.js';
import { createStateStore } from '../../src/client/state-store.js';
import { artifact } from '../fixtures/validated-artifact.js';
import type { ValidatedUiArtifact } from '@rntme/ui-legacy';

const withCommand = JSON.parse(JSON.stringify(artifact));
withCommand.routes['/a'].actions = {
  submit: {
    kind: 'command',
    binding: 'reportIssue',
    paramsFromState: { title: '/form/title' },
    onSuccess: { clearFormState: ['/form'], refetchData: [] },
  },
};

const HTTP = {
  reportIssue: { method: 'POST' as const, path: '/v1/issues' },
};

describe('driver.command', () => {
  it('POSTs with JSON body pulled from state and clears form on success', async () => {
    const store = createStateStore();
    store.set('/form/title', 'hi');
    const fetchMock = vi.fn(async (_: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ title: 'hi' });
      return new Response(JSON.stringify({ version: 1 }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const driver = createUiDriver({
      artifact: withCommand as ValidatedUiArtifact,
      bindingsHttpBaseUrl: '',
      fetch: fetchMock as unknown as typeof fetch,
      stateStore: store,
      bindingHttpByName: HTTP,
    });
    driver.enterRoute('/a');
    await driver.invokeAction('/a', 'submit');
    expect(store.get('/actions/__status/submit')).toBe('success');
    expect(store.get('/form')).toBeUndefined();
  });

  it('reflects 422 as error with body passed through', async () => {
    const store = createStateStore();
    store.set('/form/title', 'hi');
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ code: 'VALIDATION', message: 'bad' }), { status: 422, headers: { 'content-type': 'application/json' } }),
    );
    const driver = createUiDriver({
      artifact: withCommand as ValidatedUiArtifact,
      bindingsHttpBaseUrl: '',
      fetch: fetchMock as unknown as typeof fetch,
      stateStore: store,
      bindingHttpByName: HTTP,
    });
    driver.enterRoute('/a');
    await driver.invokeAction('/a', 'submit');
    expect(store.get('/actions/__status/submit')).toBe('error');
    expect(store.get('/actions/__error/submit')).toMatchObject({ httpStatus: 422, code: 'VALIDATION' });
    expect(store.get('/form/title')).toBe('hi');
  });
});

describe('driver.command — onSuccess.navigateTo with clearFormState overlap', () => {
  const withNav = JSON.parse(JSON.stringify(artifact));
  withNav.routes['/a'].actions = {
    submit: {
      kind: 'command',
      binding: 'reportIssue',
      paramsFromState: { id: '/form/id' },
      onSuccess: { clearFormState: ['/form'], navigateTo: '/detail/:id' },
    },
  };
  withNav.routes['/detail/:id'] = {
    page: { root: 'n', elements: { n: { type: 'Stack', props: {}, children: [] } } },
  };

  it('resolves navigateTo placeholders from paramsFromState before clearFormState runs', async () => {
    const store = createStateStore();
    store.set('/form/id', '42');
    const onNavigate = vi.fn();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ version: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const driver = createUiDriver({
      artifact: withNav as ValidatedUiArtifact,
      bindingsHttpBaseUrl: '',
      fetch: fetchMock as unknown as typeof fetch,
      stateStore: store,
      bindingHttpByName: { reportIssue: { method: 'POST', path: '/v1/issues' } },
      onNavigate,
    });
    await driver.invokeAction('/a', 'submit');
    expect(onNavigate).toHaveBeenCalledWith('/detail/42'); // NOT '/detail/:id'
    expect(store.get('/form')).toBeUndefined(); // clearFormState still ran
  });
});
