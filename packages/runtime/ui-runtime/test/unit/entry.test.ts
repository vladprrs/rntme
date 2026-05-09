// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompiledManifest, CompiledScreen } from '@rntme/ui';

const render = vi.fn();
const requestPath = (input: RequestInfo | URL): string => {
  if (input instanceof Request) return new URL(input.url).pathname;
  return String(input);
};

type RenderedAppShell = {
  props: {
    layoutSpec: unknown;
    screenSpec: {
      root: string;
      elements: Record<string, { type: string; props?: Record<string, unknown>; children?: string[] }>;
    } | null;
    store: {
      get: (path: string) => unknown;
    };
  };
};

function lastRenderedApp(): RenderedAppShell {
  const app = render.mock.calls.at(-1)?.[0] as RenderedAppShell | undefined;
  if (!app) throw new Error('expected AppShell to render');
  return app;
}

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({
    render,
    unmount: vi.fn()
  }))
}));

describe('mountUiRuntime', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    window.history.replaceState({}, '', '/');
    render.mockClear();
  });

  it('uses injected transport for manifest, screen, layout, and data fetches', async () => {
    const { mountUiRuntime } = await import('../../src/client/entry.js');
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
    const transport = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestPath(input);
      if (url === '/custom-manifest.json') return Response.json(manifest);
      if (url === '/_layouts/main.json') return Response.json(layout);
      if (url === '/_screens/home.json') return Response.json(screen);
      if (url === '/api/notes') return Response.json([{ id: 'n1' }]);
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;

    await mountUiRuntime({
      manifestUrl: '/custom-manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport,
      initialState: { currentUser: { sub: 'auth0|x' } }
    });

    expect(vi.mocked(transport).mock.calls.map(([input]) => requestPath(input))).toEqual([
      '/custom-manifest.json',
      '/_layouts/main.json',
      '/_screens/home.json',
      '/api/notes'
    ]);
    expect(render).toHaveBeenCalled();
  });

  it('wires module-action dispatch to the mounted operation registry', async () => {
    const { mountUiRuntime } = await import('../../src/client/entry.js');
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
      actions: {
        trackSave: {
          kind: 'module-action',
          module: '@rntme/analytics-google-analytics',
          name: 'track',
          params: { event: 'note_saved' }
        }
      }
    };
    const transport = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestPath(input);
      if (url === '/_manifest.json') return Response.json(manifest);
      if (url === '/_layouts/main.json') return Response.json(layout);
      if (url === '/_screens/home.json') return Response.json(screen);
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;
    const handler = vi.fn();

    await mountUiRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport
    });

    const app = render.mock.calls.at(-1)?.[0] as {
      props: {
        actionHandlers: Record<string, (params: Record<string, unknown>) => Promise<void>>;
        operationRegistry: {
          registerModule: (
            moduleName: string,
            name: string,
            h: (params: Record<string, unknown>) => void,
          ) => void;
        };
      };
    };
    app.props.operationRegistry.registerModule(
      '@rntme/analytics-google-analytics',
      'track',
      handler,
    );

    await app.props.actionHandlers.dispatch({ name: 'trackSave' });

    expect(handler).toHaveBeenCalledWith({ event: 'note_saved' });
  });

  it('runs module boot before mount, emits navigation, and uses transport middleware for data fetches', async () => {
    const { mountUiRuntime } = await import('../../src/client/entry.js');
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
    const navigate = vi.fn();
    const transport = vi.fn(async (input: RequestInfo | URL) => {
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

    await mountUiRuntime({
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
    const { mountUiRuntime } = await import('../../src/client/entry.js');
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
    const transport = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestPath(input);
      if (url === '/_manifest.json') return Response.json(manifest);
      if (url === '/_layouts/main.json') return Response.json(layout);
      if (url === '/_screens/home.json') return Response.json(screen);
      if (url === '/api/notes') return Response.json([{ id: 'n1' }]);
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;

    await mountUiRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport,
      initialState: { '/auth/status': 'anon' }
    });

    expect(vi.mocked(transport).mock.calls.map(([input]) => requestPath(input))).toEqual([
      '/_manifest.json',
      '/_layouts/main.json',
      '/_screens/home.json'
    ]);
  });

  it('renders not-found for unmatched initial path without redirecting to the first route', async () => {
    const { mountUiRuntime } = await import('../../src/client/entry.js');
    const manifest: CompiledManifest = {
      version: '2.0',
      metadata: { title: 'Notes' },
      routes: {
        '/': { layout: 'main', screen: 'home' },
        '/issues/:id': { layout: 'main', screen: 'issue' },
      },
    };
    const transport = vi.fn(async (input: RequestInfo | URL) => {
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
    const replaceState = vi.spyOn(window.history, 'replaceState');

    window.history.replaceState({}, '', '/missing');
    replaceState.mockClear();

    await mountUiRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport,
      initialState: { route: { params: { id: 'stale' } } } as Record<string, unknown>,
    });

    const app = lastRenderedApp();

    expect(window.location.pathname).toBe('/missing');
    expect(replaceState).not.toHaveBeenCalled();
    expect(vi.mocked(transport).mock.calls.map(([input]) => requestPath(input))).toEqual([
      '/_manifest.json',
    ]);
    expect(app.props.layoutSpec).toBeNull();
    expect(app.props.screenSpec?.root).toBe('runtimeNotFound');
    expect(app.props.screenSpec?.elements.runtimeNotFoundTitle?.props?.text).toBe('Page not found');
    expect(app.props.screenSpec?.elements.runtimeNotFoundPath?.props?.text).toBe('/missing');
    expect(app.props.store.get('/route/status')).toBe('not_found');
    expect(app.props.store.get('/route/path')).toBe('/missing');
    expect(app.props.store.get('/route/params')).toEqual({});
    expect(app.props.store.get('/route/params/id')).toBeUndefined();

    replaceState.mockRestore();
  });

  it('sets route diagnostics for matched parameterized routes', async () => {
    const { mountUiRuntime } = await import('../../src/client/entry.js');
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
    const transport = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestPath(input);
      if (url === '/_manifest.json') return Response.json(manifest);
      if (url === '/_layouts/main.json') return Response.json(layout);
      if (url === '/_screens/issue.json') return Response.json(issueScreen);
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;

    window.history.replaceState({}, '', '/issues/42');

    await mountUiRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport,
    });

    const app = lastRenderedApp();

    expect(app.props.store.get('/route/status')).toBe('ok');
    expect(app.props.store.get('/route/path')).toBe('/issues/42');
    expect(app.props.store.get('/route/params')).toEqual({ id: '42' });
    expect(app.props.store.get('/route/params/id')).toBe('42');
  });

  it('renders not-found on browser back to an unmatched path without leaving the previous screen mounted', async () => {
    const { mountUiRuntime } = await import('../../src/client/entry.js');
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
    const transport = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestPath(input);
      if (url === '/_manifest.json') return Response.json(manifest);
      if (url === '/_layouts/main.json') return Response.json(layout);
      if (url === '/_screens/issue.json') return Response.json(issueScreen);
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;

    window.history.replaceState({}, '', '/issues/42');

    await mountUiRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport,
    });

    expect(lastRenderedApp().props.screenSpec?.elements.page?.props?.text).toBe('Issue');

    window.history.pushState({}, '', '/missing');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await Promise.resolve();

    const app = lastRenderedApp();

    expect(window.location.pathname).toBe('/missing');
    expect(app.props.layoutSpec).toBeNull();
    expect(app.props.screenSpec?.root).toBe('runtimeNotFound');
    expect(app.props.store.get('/route/status')).toBe('not_found');
    expect(app.props.store.get('/route/path')).toBe('/missing');
    expect(app.props.store.get('/route/params')).toEqual({});
    expect(app.props.store.get('/route/params/id')).toBeUndefined();
  });

  it('passes route-derived renderer identity keys to AppShell and updates them on navigation', async () => {
    const { mountUiRuntime } = await import('../../src/client/entry.js');
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
    const transport = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestPath(input);
      if (url === '/_manifest.json') return Response.json(manifest);
      if (url === '/_layouts/main.json') return Response.json(layout);
      if (url === '/_screens/home.json') return Response.json(home);
      if (url === '/_screens/settings.json') return Response.json(settings);
      return new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;

    await mountUiRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport,
    });

    const firstApp = render.mock.calls.at(-1)?.[0] as {
      props: {
        actionHandlers: Record<string, (params: Record<string, unknown>) => Promise<void>>;
        layoutKey: string;
        screenKey: string;
      };
    };
    expect(firstApp.props.layoutKey).toBe('layout:main');
    expect(firstApp.props.screenKey).toBe('screen:/:home');

    await firstApp.props.actionHandlers.navigate({ to: '/settings' });

    await vi.waitFor(() => {
      const app = render.mock.calls.at(-1)?.[0] as {
        props: { layoutKey: string; screenKey: string };
      };
      expect(app.props.screenKey).toBe('screen:/settings:settings');
    });

    const secondApp = render.mock.calls.at(-1)?.[0] as {
      props: {
        layoutKey: string;
        screenKey: string;
      };
    };
    expect(secondApp.props.layoutKey).toBe('layout:main');
    expect(secondApp.props.screenKey).toBe('screen:/settings:settings');
  });
});
