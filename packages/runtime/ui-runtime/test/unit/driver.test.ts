import { describe, expect, it, vi } from 'vitest';
import { createDriver, type DriverOptions } from '../../src/client/driver.js';

function mockFetch(response: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(response),
  });
}

describe('createDriver', () => {
  it('fetches data for a screen on enterScreen', async () => {
    const fetchFn = mockFetch([{ id: 1, title: 'Issue 1' }]);
    const onStateChange = vi.fn();

    const driver = createDriver({
      fetchFn: fetchFn as unknown as typeof fetch,
      onStateChange,
      onNavigate: vi.fn(),
    });

    await driver.enterScreen({
      data: {
        '/data/issues': {
          method: 'GET',
          path: '/api/issues',
          params: { limit: 50 },
          refetchOn: ['mount'],
        },
      },
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const url = fetchFn.mock.calls[0]![0] as string;
    expect(url).toContain('/api/issues');
    expect(url).toContain('limit=50');
    expect(onStateChange).toHaveBeenCalledWith('/data/issues', [{ id: 1, title: 'Issue 1' }]);
  });

  it('sets status to pending then ok on successful fetch', async () => {
    const fetchFn = mockFetch({ result: 'ok' });
    const onStateChange = vi.fn();

    const driver = createDriver({
      fetchFn: fetchFn as unknown as typeof fetch,
      onStateChange,
      onNavigate: vi.fn(),
    });

    await driver.enterScreen({
      data: {
        '/data/items': {
          method: 'GET',
          path: '/api/items',
          refetchOn: ['mount'],
        },
      },
    });

    // First call sets pending, then data, then ok
    const calls = onStateChange.mock.calls.map(([path, val]: [string, unknown]) => [path, val]);
    expect(calls).toContainEqual(['/data/__status/data/items', 'pending']);
    expect(calls).toContainEqual(['/data/items', { result: 'ok' }]);
    expect(calls).toContainEqual(['/data/__status/data/items', 'ok']);
  });

  it('sets status to error on failed fetch', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    const onStateChange = vi.fn();

    const driver = createDriver({
      fetchFn: fetchFn as unknown as typeof fetch,
      onStateChange,
      onNavigate: vi.fn(),
    });

    await driver.enterScreen({
      data: {
        '/data/missing': {
          method: 'GET',
          path: '/api/missing',
          refetchOn: ['mount'],
        },
      },
    });

    const calls = onStateChange.mock.calls.map(([path, val]: [string, unknown]) => [path, val]);
    expect(calls).toContainEqual(['/data/__status/data/missing', 'error']);
    expect(calls).toContainEqual(['/data/__error/data/missing', 'HTTP 404']);
  });

  it('dispatches navigation action', () => {
    const onNavigate = vi.fn();
    const driver = createDriver({
      fetchFn: vi.fn() as unknown as typeof fetch,
      onStateChange: vi.fn(),
      onNavigate,
    });

    driver.dispatchAction({
      kind: 'navigation',
      navigateTo: '/issues/42',
    });

    expect(onNavigate).toHaveBeenCalledWith('/issues/42');
  });

  it('dispatches navigation action with paramsFromState', () => {
    const onNavigate = vi.fn();
    const stateGetter = vi.fn().mockReturnValue('99');
    const driver = createDriver({
      fetchFn: vi.fn() as unknown as typeof fetch,
      onStateChange: vi.fn(),
      onNavigate,
    });

    driver.dispatchAction(
      {
        kind: 'navigation',
        navigateTo: '/issues/:id',
        paramsFromState: { id: '/data/selectedId' },
      },
      stateGetter,
    );

    expect(stateGetter).toHaveBeenCalledWith('/data/selectedId');
    expect(onNavigate).toHaveBeenCalledWith('/issues/99');
  });

  it('dispatches command action and navigates on success', async () => {
    const fetchFn = mockFetch({ ok: true });
    const onNavigate = vi.fn();
    const stateGetter = vi.fn().mockReturnValue('new title');

    const driver = createDriver({
      fetchFn: fetchFn as unknown as typeof fetch,
      onStateChange: vi.fn(),
      onNavigate,
    });

    await driver.dispatchAction(
      {
        kind: 'command',
        method: 'POST',
        path: '/api/issues',
        paramsFromState: { title: '/form/title' },
        onSuccess: { navigateTo: '/issues' },
      },
      stateGetter,
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('/issues');
  });

  it('handles no data on screen gracefully', async () => {
    const fetchFn = mockFetch({});
    const onStateChange = vi.fn();

    const driver = createDriver({
      fetchFn: fetchFn as unknown as typeof fetch,
      onStateChange,
      onNavigate: vi.fn(),
    });

    await driver.enterScreen({});

    expect(fetchFn).not.toHaveBeenCalled();
    expect(onStateChange).not.toHaveBeenCalled();
  });
});

describe('driver — module-action dispatch', () => {
  it('dispatches component-bound op via target', async () => {
    const { createOperationRegistry } = await import('@rntme/contracts-client-runtime-v1');
    const reg = createOperationRegistry();
    const handler = vi.fn();
    reg.registerComponent('editor', { toggleBold: handler });
    const driver = createDriver({
      fetchFn: vi.fn() as unknown as typeof fetch,
      onStateChange: vi.fn(),
      onNavigate: vi.fn(),
      operationRegistry: reg,
    });
    await driver.dispatchAction(
      { kind: 'module-action', target: 'editor', name: 'toggleBold' },
      () => ({}),
    );
    expect(handler).toHaveBeenCalledWith({});
  });

  it('dispatches module-level op via module', async () => {
    const { createOperationRegistry } = await import('@rntme/contracts-client-runtime-v1');
    const reg = createOperationRegistry();
    const handler = vi.fn();
    reg.registerModule('@rntme/x', 'track', handler);
    const driver = createDriver({
      fetchFn: vi.fn() as unknown as typeof fetch,
      onStateChange: vi.fn(),
      onNavigate: vi.fn(),
      operationRegistry: reg,
    });
    await driver.dispatchAction(
      { kind: 'module-action', module: '@rntme/x', name: 'track', params: { event: 'click' } },
      () => ({}),
    );
    expect(handler).toHaveBeenCalledWith({ event: 'click' });
  });
});

describe('registry — module-action dispatch', () => {
  it('dispatches module actions through json-render dispatch handlers', async () => {
    const { createRegistry } = await import('../../src/client/registry.js');
    const { createOperationRegistry } = await import('@rntme/contracts-client-runtime-v1');
    const operationRegistry = createOperationRegistry();
    const handler = vi.fn();
    operationRegistry.registerModule('@rntme/analytics-google-analytics', 'track', handler);

    const screen = {
      actions: {
        trackSave: {
          kind: 'module-action',
          module: '@rntme/analytics-google-analytics',
          name: 'track',
          params: { event: 'note_saved' },
        },
      },
    } as const;

    const { handlers } = createRegistry({
      onNavigate: vi.fn(),
      getScreen: () => screen,
      store: {
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
        getSnapshot: () => ({}),
        subscribe: () => () => undefined,
      },
      fetchEndpoint: vi.fn(),
      fetchFn: vi.fn() as unknown as typeof fetch,
      operationRegistry,
    });
    const actionHandlers = handlers(
      () => vi.fn(),
      () => ({}),
    );

    await actionHandlers.dispatch({ name: 'trackSave' });

    expect(handler).toHaveBeenCalledWith({ event: 'note_saved' });
  });
});
