import './dom-setup';
import { describe, expect, it, mock } from 'bun:test';
import type { CompiledScreen } from '@rntme/ui';
import type { RuntimeBridge } from '../../src/client/registry.js';

const { createRegistry } = await import('../../src/client/registry.js');

function createBridge(screen: CompiledScreen): RuntimeBridge & {
  onNavigate: ReturnType<typeof mock>;
  fetchEndpoint: ReturnType<typeof mock>;
  fetchFn: ReturnType<typeof mock>;
  store: RuntimeBridge['store'] & { get: ReturnType<typeof mock> };
} {
  return {
    onNavigate: mock(),
    getScreen: () => screen,
    store: {
      get: mock((path: string) => {
        if (path === '/route/params/id') return 'n1';
        if (path === '/form/title') return 'Updated';
        return undefined;
      }),
      set: mock(),
      update: mock(),
      getSnapshot: () => ({}),
      subscribe: () => () => undefined,
    },
    fetchEndpoint: mock(async () => undefined),
    fetchFn: mock(async () => Response.json({ ok: true })) as unknown as ReturnType<typeof mock>,
  };
}

function actionHandlersFor(bridge: RuntimeBridge) {
  const { handlers } = createRegistry(bridge);
  return handlers(
    () => mock(),
    () => ({}),
  );
}

describe('createRegistry dispatch action handlers', () => {
  it('dispatches navigation actions with route params from state', async () => {
    const bridge = createBridge({
      spec: { root: 'page', elements: { page: { type: 'Heading', props: {} } } },
      actions: {
        openNote: {
          kind: 'navigation',
          navigateTo: '/notes/:id',
          paramsFromState: { id: '/route/params/id' },
        },
      },
    });

    await actionHandlersFor(bridge).dispatch({ name: 'openNote' });

    expect(bridge.onNavigate).toHaveBeenCalledWith('/notes/n1');
  });

  it('dispatches refetch actions to every listed data target', async () => {
    const endpoint = { method: 'GET' as const, path: '/api/notes', refetchOn: ['mount' as const] };
    const bridge = createBridge({
      spec: { root: 'page', elements: { page: { type: 'Heading', props: {} } } },
      data: {
        '/data/notes': endpoint,
      },
      actions: {
        refresh: { kind: 'refetch', targets: ['/data/notes', '/data/missing'] },
      },
    });

    await actionHandlersFor(bridge).dispatch({ name: 'refresh' });

    expect(bridge.fetchEndpoint).toHaveBeenCalledTimes(1);
    expect(bridge.fetchEndpoint).toHaveBeenCalledWith('/data/notes', endpoint);
  });

  it('dispatches command actions and refetches requested data after success', async () => {
    const endpoint = { method: 'GET' as const, path: '/api/notes', refetchOn: ['mount' as const] };
    const bridge = createBridge({
      spec: { root: 'page', elements: { page: { type: 'Heading', props: {} } } },
      data: {
        '/data/notes': endpoint,
      },
      actions: {
        save: {
          kind: 'command',
          method: 'POST',
          path: '/api/notes/{id}',
          paramsFromState: {
            id: '/route/params/id',
            title: '/form/title',
          },
          onSuccess: {
            refetchData: ['/data/notes'],
            navigateTo: '/notes',
          },
        },
      },
    });

    await actionHandlersFor(bridge).dispatch({ name: 'save' });

    expect(bridge.fetchFn).toHaveBeenCalledWith('/api/notes/n1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect(bridge.fetchEndpoint).toHaveBeenCalledWith('/data/notes', endpoint);
    expect(bridge.onNavigate).toHaveBeenCalledWith('/notes');
  });
});
