import './dom-setup';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

/** Simulates a Renderer-level failure that is not swallowed by json-render per-element boundaries (see mock below). */
const FORCE_RENDERER_THROW = '__RNTME_TEST_FORCE_RENDERER_THROW__';

const { AppShell } = await import('../../src/client/layout-manager.js');
const { createRegistry } = await import('../../src/client/registry.js');
const { createRuntimeStateStore } = await import('../../src/client/state.js');
const { createOperationRegistry, createTransportChain, useOperationRegistry, useTransport } = await import('@rntme/contracts-client-runtime-v1');

function testRegistry(components: Record<string, React.ComponentType<Record<string, unknown>>>) {
  return createRegistry({
    onNavigate: () => undefined,
    getScreen: () => null,
    store: createRuntimeStateStore(),
    fetchEndpoint: async () => undefined,
    fetchFn: fetch,
  }, {
    components: Object.keys(components).map((type) => ({
      type,
      props: { text: { type: 'string' as const } },
    })),
    reactByType: components,
  }).registry;
}

function SafeBlock(props: { text?: unknown }) {
  return React.createElement('div', null, String(props.text ?? 'ok'));
}

function ThrowingBlock() {
  const error = new Error('secret token 123');
  error.name = 'SecretToken123 Error';
  throw error;
}

function mountShell(props: Partial<React.ComponentProps<typeof AppShell>> = {}) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const root = createRoot(target);
  const store = createRuntimeStateStore();

  const baseProps: React.ComponentProps<typeof AppShell> = {
    layoutSpec: null,
    screenSpec: {
      root: 'page',
      elements: {
        page: { type: 'SafeBlock', props: { text: 'screen ok' } },
      },
    },
    registry: testRegistry({ SafeBlock, [FORCE_RENDERER_THROW]: ThrowingBlock }),
    actionHandlers: {},
    store,
    screenKey: 'screen:/',
    layoutKey: 'layout:none',
  };

  return {
    target,
    root,
    store,
    render: async (nextProps: Partial<React.ComponentProps<typeof AppShell>> = {}) => {
      await act(async () => {
        root.render(React.createElement(AppShell, { ...baseProps, ...props, ...nextProps }));
      });
    },
    unmount: () => root.unmount(),
  };
}

describe('AppShell module component bridge', () => {
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('injects authored element ids and provides the operation registry', async () => {
    const operationRegistry = createOperationRegistry();
    const handler = mock();

    function RichTextEditor(props: Record<string, unknown>) {
      const registry = useOperationRegistry();
      React.useEffect(() => {
        const elementId = props.__rntmeElementId;
        if (typeof elementId !== 'string') return undefined;
        return registry.register(elementId, { toggleBold: handler });
      }, [props, registry]);
      return React.createElement('div');
    }

    const target = document.createElement('div');
    document.body.appendChild(target);
    const root = createRoot(target);

    await act(async () => {
      root.render(
        React.createElement(AppShell, {
          layoutSpec: null,
          screenSpec: {
            root: 'editor',
            elements: {
              editor: { type: 'RichTextEditor', props: {} },
            },
          },
          registry: testRegistry({ RichTextEditor }),
          actionHandlers: {},
          store: createRuntimeStateStore(),
          operationRegistry,
        }),
      );
    });

    await operationRegistry.lookupComponent('editor', 'toggleBold')?.({});

    expect(handler).toHaveBeenCalledWith({});
  });

  it('provides the runtime transport chain to module components', async () => {
    const requests: string[] = [];
    const transportChain = createTransportChain(async (req) => {
      requests.push(new URL(req.url).pathname);
      return Response.json({ ok: true });
    });

    function TransportProbe() {
      const transport = useTransport();
      React.useEffect(() => {
        void transport(new Request('https://ui-runtime.test/api/tokens'));
      }, [transport]);
      return React.createElement('div', null, 'transport ready');
    }

    const shell = mountShell({
      registry: testRegistry({ TransportProbe }),
      screenSpec: {
        root: 'probe',
        elements: {
          probe: { type: 'TransportProbe', props: {} },
        },
      },
      transportChain,
    } as never);

    await shell.render();

    expect(shell.target.textContent).toContain('transport ready');
    expect(requests).toEqual(['/api/tokens']);
  });

  it('renders a sanitized screen fallback without unmounting the app shell', async () => {
    const shell = mountShell({
      screenSpec: {
        root: 'boom',
        elements: {
          boom: { type: FORCE_RENDERER_THROW, props: {} },
        },
      },
      screenKey: 'screen:/broken:broken',
    });

    await shell.render();

    expect(shell.target.querySelector('#rntme-app')).not.toBeNull();
    expect(shell.target.querySelector('#rntme-screen')).not.toBeNull();
    expect(shell.target.querySelector('#rntme-screen-error')?.textContent).toContain(
      'This screen failed to render.',
    );
    expect(shell.target.textContent).not.toContain('secret token 123');

    const record = shell.store.get('/runtime/renderErrors/screen') as {
      scope: string;
      identity: string;
      message: string;
      errorName: string;
    };

    expect(record).toMatchObject({
      scope: 'screen',
      identity: 'screen:/broken:broken',
      message: 'Renderer failed',
      errorName: 'UnknownError',
    });
    expect(JSON.stringify(record)).not.toContain('secret token 123');
    expect(JSON.stringify(record)).not.toContain('SecretToken123');
    expect(
      consoleErrorSpy.mock.calls.some(([message]) => message === '[rntme] UI renderer failed'),
    ).toBe(true);
  });

  it('renders a layout fallback while the screen still renders', async () => {
    const shell = mountShell({
      layoutSpec: {
        root: 'layout',
        elements: {
          layout: { type: FORCE_RENDERER_THROW, props: {} },
        },
      },
      layoutKey: 'layout:main',
      screenSpec: {
        root: 'page',
        elements: {
          page: { type: 'SafeBlock', props: { text: 'screen survived' } },
        },
      },
    });

    await shell.render();

    expect(shell.target.querySelector('#rntme-layout-error')?.textContent).toContain(
      'This layout failed to render.',
    );
    expect(shell.target.querySelector('#rntme-screen')?.textContent).toContain('screen survived');
    expect(shell.store.get('/runtime/renderErrors/layout')).toMatchObject({
      scope: 'layout',
      identity: 'layout:main',
      message: 'Renderer failed',
    });
  });

  it('renders the screen inside a layout Slot', async () => {
    const shell = mountShell({
      layoutSpec: {
        root: 'shell',
        elements: {
          shell: { type: 'Box', props: {}, children: ['slot'] },
          slot: { type: 'Slot', props: {} },
        },
      },
      layoutKey: 'layout:main',
      screenSpec: {
        root: 'page',
        elements: {
          page: { type: 'SafeBlock', props: { text: 'screen through slot' } },
        },
      },
    });

    await shell.render();

    expect(shell.target.querySelector('#rntme-layout')?.textContent).toContain('screen through slot');
  });

  it('resets a failed screen boundary when screenKey changes', async () => {
    const shell = mountShell({
      screenSpec: {
        root: 'boom',
        elements: {
          boom: { type: FORCE_RENDERER_THROW, props: {} },
        },
      },
      screenKey: 'screen:/broken:broken',
    });

    await shell.render();
    expect(shell.target.querySelector('#rntme-screen-error')).not.toBeNull();

    await shell.render({
      screenKey: 'screen:/healthy:healthy',
      screenSpec: {
        root: 'page',
        elements: {
          page: { type: 'SafeBlock', props: { text: 'healthy screen' } },
        },
      },
    });

    expect(shell.target.querySelector('#rntme-screen-error')).toBeNull();
    expect(shell.target.querySelector('#rntme-screen')?.textContent).toContain('healthy screen');
    expect(shell.store.get('/runtime/renderErrors/screen')).toBeUndefined();
  });
});
