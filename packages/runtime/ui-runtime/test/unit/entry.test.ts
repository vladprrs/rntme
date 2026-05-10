import './dom-setup';
import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import * as React from 'react';
import { act } from 'react';
import type { CompiledManifest, CompiledScreen } from '@rntme/ui';
import { useModuleAction } from '@rntme/contracts-client-runtime-v1';
import type { MountUiRuntimeOptions, MountUiRuntimeResult } from '../../src/client/entry.js';

const requestPath = (input: RequestInfo | URL): string => {
  if (input instanceof Request) return new URL(input.url).pathname;
  return String(input);
};

type RuntimeStoreProbe = {
  get: (path: string) => unknown;
};

async function mountRuntime(opts: MountUiRuntimeOptions): Promise<MountUiRuntimeResult> {
  const { mountUiRuntime } = await import('../../src/client/entry.js');
  let result: MountUiRuntimeResult | undefined;
  await act(async () => {
    result = await mountUiRuntime(opts);
  });
  if (!result) throw new Error('expected runtime to mount');
  return result;
}

function waitFor(condition: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const tick = () => {
      if (condition()) {
        resolve();
        return;
      }
      attempt += 1;
      if (attempt > 25) {
        reject(new Error('condition was not met'));
        return;
      }
      setTimeout(tick, 10);
    };
    tick();
  });
}

function ModuleActionProbe() {
  const track = useModuleAction('@rntme/analytics-google-analytics', 'track');
  React.useEffect(() => {
    void track({ event: 'note_saved' });
  }, [track]);
  return null;
}

describe('mountUiRuntime', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    window.history.replaceState({}, '', '/');
  });

  it('uses injected transport for manifest, screen, layout, and data fetches', async () => {
    const manifest: CompiledManifest = {
      version: '2.0',
      metadata: { title: 'Notes' },
      routes: {
        '/': { layout: 'main', screen: 'home' }
      }
    };
    const layout: CompiledScreen = {
      spec: {
        root: 'layout',
        elements: {
          layout: { type: 'Stack', props: {} }
        }
      }
    };
    const screen: CompiledScreen = {
      spec: {
        root: 'page',
        elements: {
          page: { type: 'Heading', props: { text: 'Home' } }
        }
      },
      data: {
        '/data/notes': {
          method: 'GET',
          path: '/api/notes',
          refetchOn: ['mount']
        }
      }
    };
    const transport = mock(async (input: RequestInfo | URL) => {
      const url = requestPath(input);
      if (url === '/custom-manifest.json') return Response.json(manifest);
      if (url === '/_layouts/main.json') return Response.json(layout);
      if (url === '/_screens/home.json') return Response.json(screen);
      if (url === '/api/notes') return Response.json([{ id: 'n1' }]);
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;

    await mountRuntime({
      manifestUrl: '/custom-manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport,
      initialState: { currentUser: { sub: 'auth0|x' } }
    });

    expect(transport.mock.calls.map(([input]) => requestPath(input))).toEqual([
      '/custom-manifest.json',
      '/_layouts/main.json',
      '/_screens/home.json',
      '/api/notes'
    ]);
    expect(document.querySelector('#rntme-app')).not.toBeNull();
  });

  it('wires module actions to the mounted operation registry', async () => {
    const manifest: CompiledManifest = {
      version: '2.0',
      metadata: { title: 'Notes' },
      routes: {
        '/': { layout: 'main', screen: 'home' }
      }
    };
    const layout: CompiledScreen = {
      spec: {
        root: 'layout',
        elements: {
          layout: { type: 'Stack', props: {} }
        }
      }
    };
    const screen: CompiledScreen = {
      spec: {
        root: 'page',
        elements: {
          page: { type: 'ModuleActionProbe', props: {} }
        }
      },
    };
    const transport = mock(async (input: RequestInfo | URL) => {
      const url = requestPath(input);
      if (url === '/_manifest.json') return Response.json(manifest);
      if (url === '/_layouts/main.json') return Response.json(layout);
      if (url === '/_screens/home.json') return Response.json(screen);
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;
    const handler = mock();

    await mountRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport,
      moduleCatalogComponents: [{ type: 'ModuleActionProbe', props: {} }],
      moduleComponents: { ModuleActionProbe },
      modules: [
        {
          name: '@rntme/analytics-google-analytics',
          boot: (ctx) => {
            ctx.registerOperation('track', handler);
          },
        },
      ],
    });

    await waitFor(() => handler.mock.calls.length > 0);
    expect(handler).toHaveBeenCalledWith({ event: 'note_saved' });
  });

  it('runs module boot before mount, emits navigation, and uses transport middleware for data fetches', async () => {
    const manifest: CompiledManifest = {
      version: '2.0',
      metadata: { title: 'Notes' },
      routes: {
        '/': { layout: 'main', screen: 'home' }
      }
    };
    const layout: CompiledScreen = {
      spec: {
        root: 'layout',
        elements: {
          layout: { type: 'Stack', props: {} }
        }
      }
    };
    const screen: CompiledScreen = {
      spec: {
        root: 'page',
        elements: {
          page: { type: 'Heading', props: { text: 'Home' } }
        }
      },
      data: {
        '/data/notes': {
          method: 'GET',
          path: '/api/notes',
          refetchOn: ['mount']
        }
      }
    };
    const seenAuth: Array<string | null> = [];
    const navigate = mock();
    const transport = mock(async (input: RequestInfo | URL) => {
      const url = requestPath(input);
      if (url === '/_manifest.json') return Response.json(manifest);
      if (url === '/config.json') return Response.json({ '@rntme/analytics-google-analytics': { measurementId: 'G-X' } });
      if (url === '/_layouts/main.json') return Response.json(layout);
      if (url === '/_screens/home.json') return Response.json(screen);
      if (url === '/api/notes') {
        seenAuth.push(input instanceof Request ? input.headers.get('authorization') : null);
        return Response.json([{ id: 'n1' }]);
      }
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;

    await mountRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport,
      modules: [
        {
          name: '@rntme/analytics-google-analytics',
          boot: (ctx) => {
            expect(ctx.config.measurementId).toBe('G-X');
            ctx.on('navigate', navigate);
            ctx.transport.use(async (req, next) => {
              const headers = new Headers(req.headers);
              headers.set('authorization', 'Bearer module');
              return next(new Request(req, { headers }));
            });
          }
        }
      ]
    });

    expect(navigate).toHaveBeenCalledWith({ path: '/', params: {} });
    expect(seenAuth).toEqual(['Bearer module']);
  });

  it('skips mount refetches when the loaded screen root is not visible', async () => {
    const manifest: CompiledManifest = {
      version: '2.0',
      metadata: { title: 'Notes' },
      routes: {
        '/': { layout: 'main', screen: 'home' }
      }
    };
    const layout: CompiledScreen = {
      spec: {
        root: 'layout',
        elements: {
          layout: { type: 'Stack', props: {} }
        }
      }
    };
    const screen: CompiledScreen = {
      spec: {
        root: 'page',
        elements: {
          page: {
            type: 'Stack',
            props: {},
            visible: { $state: '/auth/status', eq: 'authed' }
          }
        }
      },
      data: {
        '/data/notes': {
          method: 'GET',
          path: '/api/notes',
          refetchOn: ['mount']
        }
      }
    };
    const transport = mock(async (input: RequestInfo | URL) => {
      const url = requestPath(input);
      if (url === '/_manifest.json') return Response.json(manifest);
      if (url === '/_layouts/main.json') return Response.json(layout);
      if (url === '/_screens/home.json') return Response.json(screen);
      if (url === '/api/notes') return Response.json([{ id: 'n1' }]);
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;

    await mountRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport,
      initialState: { '/auth/status': 'anon' }
    });

    expect(transport.mock.calls.map(([input]) => requestPath(input))).toEqual([
      '/_manifest.json',
      '/_layouts/main.json',
      '/_screens/home.json'
    ]);
  });

  it('renders not-found for unmatched initial path without redirecting to the first route', async () => {
    const manifest: CompiledManifest = {
      version: '2.0',
      metadata: { title: 'Notes' },
      routes: {
        '/': { layout: 'main', screen: 'home' },
        '/issues/:id': { layout: 'main', screen: 'issue' },
      },
    };
    const transport = mock(async (input: RequestInfo | URL) => {
      const url = requestPath(input);
      if (url === '/_manifest.json') return Response.json(manifest);
      if (url === '/_layouts/main.json') {
        throw new Error('unmatched route must not load the first layout');
      }
      if (url === '/_screens/home.json' || url === '/_screens/issue.json') {
        throw new Error('unmatched route must not load a manifest screen');
      }
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;
    const replaceState = spyOn(window.history, 'replaceState');
    let store: RuntimeStoreProbe | undefined;

    window.history.replaceState({}, '', '/missing');
    replaceState.mockClear();

    await mountRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport,
      initialState: { route: { params: { id: 'stale' } } } as Record<string, unknown>,
      modules: [{ name: 'probe', boot: (ctx) => { store = ctx.state; } }],
    });

    expect(window.location.pathname).toBe('/missing');
    expect(replaceState).not.toHaveBeenCalled();
    expect(transport.mock.calls.map(([input]) => requestPath(input))).toEqual([
      '/_manifest.json',
      '/config.json',
    ]);
    expect(document.querySelector('#rntme-app')).not.toBeNull();
    expect(store?.get('/route/status')).toBe('not_found');
    expect(store?.get('/route/path')).toBe('/missing');
    expect(store?.get('/route/params')).toEqual({});
    expect(store?.get('/route/params/id')).toBeUndefined();

    replaceState.mockRestore();
  });

  it('sets route diagnostics for matched parameterized routes', async () => {
    const manifest: CompiledManifest = {
      version: '2.0',
      metadata: { title: 'Notes' },
      routes: {
        '/': { layout: 'main', screen: 'home' },
        '/issues/:id': { layout: 'main', screen: 'issue' },
      },
    };
    const layout: CompiledScreen = {
      spec: {
        root: 'layout',
        elements: {
          layout: { type: 'Stack', props: {} },
        },
      },
    };
    const issueScreen: CompiledScreen = {
      spec: {
        root: 'page',
        elements: {
          page: { type: 'Heading', props: { text: 'Issue' } },
        },
      },
    };
    const transport = mock(async (input: RequestInfo | URL) => {
      const url = requestPath(input);
      if (url === '/_manifest.json') return Response.json(manifest);
      if (url === '/_layouts/main.json') return Response.json(layout);
      if (url === '/_screens/issue.json') return Response.json(issueScreen);
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;
    let store: RuntimeStoreProbe | undefined;

    window.history.replaceState({}, '', '/issues/42');

    await mountRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport,
      modules: [{ name: 'probe', boot: (ctx) => { store = ctx.state; } }],
    });

    expect(store?.get('/route/status')).toBe('ok');
    expect(store?.get('/route/path')).toBe('/issues/42');
    expect(store?.get('/route/params')).toEqual({ id: '42' });
    expect(store?.get('/route/params/id')).toBe('42');
  });

  it('renders not-found on browser back to an unmatched path without leaving the previous screen mounted', async () => {
    const manifest: CompiledManifest = {
      version: '2.0',
      metadata: { title: 'Notes' },
      routes: {
        '/issues/:id': { layout: 'main', screen: 'issue' },
      },
    };
    const layout: CompiledScreen = {
      spec: {
        root: 'layout',
        elements: {
          layout: { type: 'Stack', props: {} },
        },
      },
    };
    const issueScreen: CompiledScreen = {
      spec: {
        root: 'page',
        elements: {
          page: { type: 'Heading', props: { text: 'Issue' } },
        },
      },
    };
    const transport = mock(async (input: RequestInfo | URL) => {
      const url = requestPath(input);
      if (url === '/_manifest.json') return Response.json(manifest);
      if (url === '/_layouts/main.json') return Response.json(layout);
      if (url === '/_screens/issue.json') return Response.json(issueScreen);
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;
    let store: RuntimeStoreProbe | undefined;

    window.history.replaceState({}, '', '/issues/42');

    await mountRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport,
      modules: [{ name: 'probe', boot: (ctx) => { store = ctx.state; } }],
    });

    expect(store?.get('/route/status')).toBe('ok');

    await act(async () => {
      window.history.pushState({}, '', '/missing');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await Promise.resolve();
    });
    await waitFor(() => store?.get('/route/status') === 'not_found');

    expect(window.location.pathname).toBe('/missing');
    expect(store?.get('/route/status')).toBe('not_found');
    expect(store?.get('/route/path')).toBe('/missing');
    expect(store?.get('/route/params')).toEqual({});
    expect(store?.get('/route/params/id')).toBeUndefined();
  });

  it('updates the mounted screen when browser navigation changes routes', async () => {
    const manifest: CompiledManifest = {
      version: '2.0',
      metadata: { title: 'Notes' },
      routes: {
        '/': { layout: 'main', screen: 'home' },
        '/settings': { layout: 'main', screen: 'settings' },
      },
    };
    const layout: CompiledScreen = {
      spec: {
        root: 'layout',
        elements: {
          layout: { type: 'Stack', props: {} },
        },
      },
    };
    const home: CompiledScreen = {
      spec: {
        root: 'home',
        elements: {
          home: { type: 'Heading', props: { text: 'Home' } },
        },
      },
    };
    const settings: CompiledScreen = {
      spec: {
        root: 'settings',
        elements: {
          settings: { type: 'Heading', props: { text: 'Settings' } },
        },
      },
    };
    const transport = mock(async (input: RequestInfo | URL) => {
      const url = requestPath(input);
      if (url === '/_manifest.json') return Response.json(manifest);
      if (url === '/_layouts/main.json') return Response.json(layout);
      if (url === '/_screens/home.json') return Response.json(home);
      if (url === '/_screens/settings.json') return Response.json(settings);
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;
    let store: RuntimeStoreProbe | undefined;

    await mountRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport,
      modules: [{ name: 'probe', boot: (ctx) => { store = ctx.state; } }],
    });

    expect(store?.get('/route/path')).toBe('/');

    await act(async () => {
      window.history.pushState({}, '', '/settings');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await Promise.resolve();
    });
    await waitFor(() => store?.get('/route/path') === '/settings');

    expect(store?.get('/route/status')).toBe('ok');
    expect(transport.mock.calls.map(([input]) => requestPath(input))).toContain('/_screens/settings.json');
  });
});
