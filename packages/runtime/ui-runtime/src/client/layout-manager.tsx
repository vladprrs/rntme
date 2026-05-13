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
  TransportProvider,
  type TransportChain,
} from '@rntme/contracts-client-runtime-v1';
import { RendererErrorBoundary } from './renderer-error-boundary.js';

export type AppShellProps = {
  layoutSpec: CompiledSpec | null;
  screenSpec: CompiledSpec | null;
  registry: ComponentRegistry;
  actionHandlers: Record<string, (params: Record<string, unknown>) => Promise<void>>;
  store: StateStore;
  transportChain?: TransportChain;
  operationRegistry?: OperationRegistry;
  layoutKey?: string | undefined;
  screenKey?: string | undefined;
};

/**
 * Carries the rendered screen element so a `Slot` element inside a layout
 * spec can drop the screen into the correct position.
 */
const SlotContext = React.createContext<React.ReactNode>(null);

function SlotHost(): React.ReactElement {
  const slot = React.useContext(SlotContext);
  return React.createElement(React.Fragment, null, slot);
}

/** Patched layout registry: replaces the no-op `Slot` component with one
 *  that pulls the screen out of `SlotContext`. */
function withSlotComponent(registry: ComponentRegistry): ComponentRegistry {
  const components = (registry as unknown as { components?: Record<string, unknown> }).components;
  if (components) {
    const patched: Record<string, unknown> = {
      ...components,
      Slot: { Component: SlotHost, schema: { props: {} } },
    };
    return { ...(registry as object), components: patched } as unknown as ComponentRegistry;
  }

  return {
    ...(registry as unknown as Record<string, unknown>),
    Slot: SlotHost,
  } as unknown as ComponentRegistry;
}

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

function specHasSlot(spec: CompiledSpec | null): boolean {
  if (!spec) return false;
  for (const el of Object.values(spec.elements)) {
    if (el.type === 'Slot') return true;
  }
  return false;
}

export function AppShell({
  layoutSpec,
  screenSpec,
  registry,
  actionHandlers,
  store,
  transportChain,
  operationRegistry,
  layoutKey = layoutSpec ? 'layout:default' : 'layout:none',
  screenKey = 'screen:default',
}: AppShellProps): React.ReactElement {
  if (!screenSpec) {
    return React.createElement('div', { id: 'rntme-loading' }, 'Loading...');
  }

  const layoutRendererSpec = injectRuntimeElementIds(layoutSpec) as unknown as Spec | null;
  const screenRendererSpec = injectRuntimeElementIds(screenSpec) as unknown as Spec;

  const screenElement = React.createElement(
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
  );

  const hasLayout = !!layoutRendererSpec;
  const layoutWantsSlot = specHasSlot(layoutSpec);
  const layoutRegistry = hasLayout && layoutWantsSlot ? withSlotComponent(registry) : registry;

  let content: React.ReactElement;
  if (hasLayout && layoutWantsSlot) {
    content = React.createElement(
      'div',
      { id: 'rntme-app' },
      React.createElement(
        SlotContext.Provider,
        { value: screenElement },
        React.createElement(
          'div',
          { id: 'rntme-layout', key: 'layout' },
          React.createElement(RendererErrorBoundary, {
            key: layoutKey,
            scope: 'layout',
            identity: layoutKey,
            store,
            fallbackId: 'rntme-layout-error',
            children: React.createElement(Renderer, { spec: layoutRendererSpec, registry: layoutRegistry }),
          }),
        ),
      ),
    );
  } else if (hasLayout) {
    content = React.createElement(
      'div',
      { id: 'rntme-app' },
      React.createElement(
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
      ),
      screenElement,
    );
  } else {
    content = React.createElement('div', { id: 'rntme-app' }, screenElement);
  }

  const runtimeContext = React.createElement(
    StoreProvider,
    { value: store },
    transportChain
      ? React.createElement(
          TransportProvider,
          { value: transportChain },
          operationRegistry
            ? React.createElement(RegistryProvider, { value: operationRegistry }, content)
            : content,
        )
      : operationRegistry
        ? React.createElement(RegistryProvider, { value: operationRegistry }, content)
        : content,
  );

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
