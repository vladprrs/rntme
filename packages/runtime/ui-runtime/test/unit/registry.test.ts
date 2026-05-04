import { describe, expect, it, vi } from 'vitest';
import type { CompiledScreen } from '@rntme/ui';
import { createRegistry, type RuntimeBridge } from '../../src/client/registry.js';

function createBridge(screen: CompiledScreen): RuntimeBridge & {
  onNavigate: ReturnType<typeof vi.fn>;
  fetchEndpoint: ReturnType<typeof vi.fn>;
  fetchFn: ReturnType<typeof vi.fn>;
  store: RuntimeBridge['store'] & { get: ReturnType<typeof vi.fn> };
} {
  return {
    onNavigate: vi.fn(),
    getScreen: () => screen,
    store: {
      get: vi.fn((path: string) => {
        if (path === '/route/params/id') return 'n1';
        if (path === '/form/title') return 'Updated';
        return undefined;
      }),
      set: vi.fn(),
      update: vi.fn(),
      getSnapshot: () => ({}),
      subscribe: () => () => undefined,
    },
    fetchEndpoint: vi.fn(async () => undefined),
    fetchFn: vi.fn(async () => Response.json({ ok: true })) as unknown as ReturnType<typeof vi.fn>,
  };
}

function actionHandlersFor(bridge: RuntimeBridge) {
  const { handlers } = createRegistry(bridge);
  return handlers(
    () => vi.fn(),
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
