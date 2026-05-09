// @vitest-environment happy-dom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentRenderProps } from '@json-render/react';
import { createOperationRegistry, useOperationRegistry } from '@rntme/contracts-client-runtime-v1';
import { AppShell } from '../../src/client/layout-manager.js';
import { createRuntimeStateStore } from '../../src/client/state.js';

/** Simulates a Renderer-level failure that is not swallowed by json-render per-element boundaries (see mock below). */
const FORCE_RENDERER_THROW = '__RNTME_TEST_FORCE_RENDERER_THROW__';

vi.mock('@json-render/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@json-render/react')>();
  function RendererWithTestHook(props: React.ComponentProps<typeof actual.Renderer>) {
    const spec = props.spec;
    if (spec?.elements && spec.root) {
      const root = spec.elements[spec.root];
      if (root && (root as { type?: string }).type === FORCE_RENDERER_THROW) {
        const error = new Error('secret token 123');
        error.name = 'SecretToken123 Error';
        throw error;
      }
    }
    return React.createElement(actual.Renderer, props);
  }
  return { ...actual, Renderer: RendererWithTestHook };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

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
    registry: {
      SafeBlock: ({ element }) =>
        React.createElement('div', null, String(element.props.text ?? 'ok')),
    },
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
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('injects authored element ids and provides the operation registry', async () => {
    const operationRegistry = createOperationRegistry();
    const handler = vi.fn();

    function RichTextEditor({ element }: ComponentRenderProps) {
      const registry = useOperationRegistry();
      React.useEffect(() => {
        const elementId = element.props.__rntmeElementId;
        if (typeof elementId !== 'string') return undefined;
        return registry.register(elementId, { toggleBold: handler });
      }, [element, registry]);
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
          registry: { RichTextEditor },
          actionHandlers: {},
          store: createRuntimeStateStore(),
          operationRegistry,
        }),
      );
    });

    await operationRegistry.lookupComponent('editor', 'toggleBold')?.({});

    expect(handler).toHaveBeenCalledWith({});
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
