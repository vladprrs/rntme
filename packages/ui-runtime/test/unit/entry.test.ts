// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompiledManifest, CompiledScreen } from '@rntme/ui';

const render = vi.fn();

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
      const url = String(input);
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

    expect(vi.mocked(transport).mock.calls.map(([input]) => String(input))).toEqual([
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
      const url = String(input);
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
});
