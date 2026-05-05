// @vitest-environment happy-dom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentRenderProps } from '@json-render/react';
import { createOperationRegistry, useOperationRegistry } from '@rntme/contracts-client-runtime-v1';
import { AppShell } from '../../src/client/layout-manager.js';
import { createRuntimeStateStore } from '../../src/client/state.js';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('AppShell module component bridge', () => {
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
});
