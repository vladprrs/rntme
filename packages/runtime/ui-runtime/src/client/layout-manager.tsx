import * as React from 'react';
import type { CompiledSpec } from '@rntme/ui';
import { Renderer, StateProvider, ActionProvider, VisibilityProvider, ValidationProvider } from '@json-render/react';
import type { Spec } from '@json-render/react';
import type { StateStore } from '@json-render/core';
import type { ComponentRegistry } from '@json-render/react';
import {
  type OperationRegistry,
  RegistryProvider,
  StoreProvider,
} from '@rntme/contracts-client-runtime-v1';
import { RendererErrorBoundary } from './renderer-error-boundary.js';

export type AppShellProps = {
  layoutSpec: CompiledSpec | null;
  screenSpec: CompiledSpec | null;
  registry: ComponentRegistry;
  actionHandlers: Record<string, (params: Record<string, unknown>) => Promise<void>>;
  store: StateStore;
  operationRegistry?: OperationRegistry;
  layoutKey?: string | undefined;
  screenKey?: string | undefined;
};

function injectRuntimeElementIds(spec: CompiledSpec | null): CompiledSpec | null {
  if (!spec) return null;
  const elements: CompiledSpec['elements'] = {};
  for (const [key, element] of Object.entries(spec.elements)) {
    elements[key] = {
      ...element,
      props: {
        ...element.props,
        __rntmeElementId: key,
      },
    };
  }
  return { ...spec, elements };
}

export function AppShell({
  layoutSpec,
  screenSpec,
  registry,
  actionHandlers,
  store,
  operationRegistry,
  layoutKey = layoutSpec ? 'layout:default' : 'layout:none',
  screenKey = 'screen:default',
}: AppShellProps): React.ReactElement {
  if (!screenSpec) {
    return React.createElement('div', { id: 'rntme-loading' }, 'Loading...');
  }

  const layoutRendererSpec = injectRuntimeElementIds(layoutSpec) as unknown as Spec | null;
  const screenRendererSpec = injectRuntimeElementIds(screenSpec) as unknown as Spec;

  const content = React.createElement(
    'div',
    { id: 'rntme-app', style: { maxWidth: 960, margin: '0 auto', padding: 24 } },
    layoutRendererSpec
      ? React.createElement(
          'div',
          { id: 'rntme-layout', key: 'layout' },
          React.createElement(RendererErrorBoundary, {
              key: layoutKey,
              scope: 'layout',
              identity: layoutKey,
              store,
              fallbackId: 'rntme-layout-error',
              children: React.createElement(Renderer, { spec: layoutRendererSpec, registry }),
            }),
        )
      : null,
    React.createElement(
      'div',
      { id: 'rntme-screen', key: 'screen' },
      React.createElement(RendererErrorBoundary, {
        key: screenKey,
        scope: 'screen',
        identity: screenKey,
        store,
        fallbackId: 'rntme-screen-error',
        children: React.createElement(Renderer, { spec: screenRendererSpec, registry }),
      }),
    ),
  );
  const runtimeContext = operationRegistry
    ? React.createElement(StoreProvider, { value: store },
        React.createElement(RegistryProvider, { value: operationRegistry }, content),
      )
    : content;

  return React.createElement(
    StateProvider, { store, children: null } as React.ComponentProps<typeof StateProvider>,
    React.createElement(ActionProvider, { handlers: actionHandlers, children: null } as React.ComponentProps<typeof ActionProvider>,
      React.createElement(VisibilityProvider, { children: null } as React.ComponentProps<typeof VisibilityProvider>,
        React.createElement(ValidationProvider, { children: null } as React.ComponentProps<typeof ValidationProvider>,
          runtimeContext,
        ),
      ),
    ),
  );
}
