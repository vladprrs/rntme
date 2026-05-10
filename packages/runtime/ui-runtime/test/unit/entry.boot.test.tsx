import './dom-setup';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { act } from 'react';
import type { CompiledManifest, CompiledScreen } from '@rntme/ui';
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
  return mock(async (input: RequestInfo | URL) => {
    const url = requestPath(input);
    if (url === '/_manifest.json') return Response.json(manifest);
    if (url === '/_layouts/main.json') return Response.json(layout);
    if (url === '/_screens/home.json') return Response.json(screen);
    return new Response('missing', { status: 404 });
  }) as unknown as typeof fetch;
}

describe('mountUiRuntime boot resilience', () => {
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    window.history.replaceState({}, '', '/');
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('still calls createRoot when a module boot throws', async () => {

    await mountRuntime({
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

    expect(document.querySelector('#rntme-app')).not.toBeNull();
  });

  it('sets /auth/status to anon when an identity module fails before setting it', async () => {
    let observedStatus: unknown;
    let observedUser: unknown;

    await mountRuntime({
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
            observedUser = ctx.state.get('/auth/user');
          }
        }
      ]
    });

    expect(observedStatus).toBe('anon');
    expect(observedUser).toBeNull();
  });

  it('records module boot errors in runtime state after mount', async () => {
    let store: RuntimeStoreProbe | undefined;

    await mountRuntime({
      manifestUrl: '/_manifest.json',
      target: document.querySelector<HTMLElement>('#root')!,
      transport: makeTransport(),
      modules: [
        {
          name: 'failing',
          boot: async () => {
            throw new Error('boot exploded');
          }
        },
        {
          name: 'probe',
          boot: (ctx) => {
            store = ctx.state;
          },
        }
      ]
    });

    const bootErrors = store?.get('/runtime/bootErrors') as Array<{
      moduleName: string;
      cause: unknown;
    }>;

    expect(bootErrors).toHaveLength(1);
    expect(bootErrors[0]?.moduleName).toBe('failing');
    expect(bootErrors[0]?.cause).toBeInstanceOf(Error);
  });

  it('does not overwrite /auth/status when identity module set it before throwing', async () => {
    let observedStatus: unknown;

    await mountRuntime({
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
    let observedStatus: unknown;

    await mountRuntime({
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
    let secondBooted = false;

    await mountRuntime({
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
