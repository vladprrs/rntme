// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompiledManifest, CompiledScreen } from '@rntme/ui';

const render = vi.fn();
const requestPath = (input: RequestInfo | URL): string => {
  if (input instanceof Request) return new URL(input.url).pathname;
  return String(input);
};

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({
    render,
    unmount: vi.fn()
  }))
}));

const manifest: CompiledManifest = {
  version: '2.0',
  metadata: { title: 'Boot Test' },
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
  }
};

function makeTransport() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = requestPath(input);
    if (url === '/_manifest.json') return Response.json(manifest);
    if (url === '/_layouts/main.json') return Response.json(layout);
    if (url === '/_screens/home.json') return Response.json(screen);
    return new Response('missing', { status: 404 });
  }) as unknown as typeof fetch;
}

describe('mountUiRuntime boot resilience', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    window.history.replaceState({}, '', '/');
    render.mockClear();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('still calls createRoot when a module boot throws', async () => {
    const { mountUiRuntime } = await import('../../src/client/entry.js');

    await mountUiRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport: makeTransport(),
      modules: [
        {
          name: 'failing',
          boot: async () => {
            throw new Error('boot exploded');
          }
        }
      ]
    });

    expect(render).toHaveBeenCalled();
  });

  it('sets /auth/status to anon when an identity module fails before setting it', async () => {
    const { mountUiRuntime } = await import('../../src/client/entry.js');
    let observedStatus: unknown;

    await mountUiRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport: makeTransport(),
      modules: [
        {
          name: 'identity',
          bootContract: 'identity',
          boot: async () => {
            throw new Error('auth failed');
          }
        },
        {
          name: 'probe',
          boot: async (ctx) => {
            observedStatus = ctx.state.get('/auth/status');
          }
        }
      ]
    });

    expect(observedStatus).toBe('anon');
  });

  it('does not overwrite /auth/status when identity module set it before throwing', async () => {
    const { mountUiRuntime } = await import('../../src/client/entry.js');
    let observedStatus: unknown;

    await mountUiRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport: makeTransport(),
      modules: [
        {
          name: 'identity',
          bootContract: 'identity',
          boot: async (ctx) => {
            ctx.state.set('/auth/status', 'authed');
            throw new Error('auth partial failure');
          }
        },
        {
          name: 'probe',
          boot: async (ctx) => {
            observedStatus = ctx.state.get('/auth/status');
          }
        }
      ]
    });

    expect(observedStatus).toBe('authed');
  });

  it('does not touch /auth/status when a non-identity module fails', async () => {
    const { mountUiRuntime } = await import('../../src/client/entry.js');
    let observedStatus: unknown;

    await mountUiRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport: makeTransport(),
      modules: [
        {
          name: 'nocontract',
          boot: async () => {
            throw new Error('non-identity failure');
          }
        },
        {
          name: 'probe',
          boot: async (ctx) => {
            observedStatus = ctx.state.get('/auth/status');
          }
        }
      ]
    });

    expect(observedStatus).toBeUndefined();
  });

  it('continues to boot remaining modules when one times out', async () => {
    const { mountUiRuntime } = await import('../../src/client/entry.js');
    let secondBooted = false;

    await mountUiRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport: makeTransport(),
      modules: [
        {
          name: 'slow',
          bootTimeoutMs: 50,
          boot: () => new Promise<void>(() => {/* never resolves */})
        },
        {
          name: 'fast',
          boot: async () => {
            secondBooted = true;
          }
        }
      ]
    });

    expect(secondBooted).toBe(true);
  });
});
