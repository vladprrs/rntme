import * as React from 'react';
import type { CompiledSpec } from '@rntme/ui';
import { Renderer, StateProvider, ActionProvider, VisibilityProvider } from '@json-render/react';
import type { Spec } from '@json-render/react';
import type { StateStore } from './state-store.js';
import type { ComponentRegistry } from '@json-render/react';

export type AppShellProps = {
  layoutSpec: CompiledSpec | null;
  screenSpec: CompiledSpec | null;
  registry: ComponentRegistry;
  actionHandlers: Record<string, (params: Record<string, unknown>) => Promise<void>>;
  store: StateStore;
};

export function AppShell({ layoutSpec, screenSpec, registry, actionHandlers, store }: AppShellProps): React.ReactElement {
  if (!screenSpec) {
    return React.createElement('div', { id: 'rntme-loading' }, 'Loading...');
  }

  const layoutRendererSpec = layoutSpec as unknown as Spec | null;
  const screenRendererSpec = screenSpec as unknown as Spec;

  return React.createElement(
    StateProvider,
    { store, children: null } as React.ComponentProps<typeof StateProvider>,
    React.createElement(
      ActionProvider,
      { handlers: actionHandlers, children: null } as React.ComponentProps<typeof ActionProvider>,
      React.createElement(
        VisibilityProvider,
        { children: null } as React.ComponentProps<typeof VisibilityProvider>,
        React.createElement(
          'div',
          { id: 'rntme-app', style: { maxWidth: 960, margin: '0 auto', padding: 24 } },
          layoutRendererSpec
            ? React.createElement('div', { id: 'rntme-layout', key: 'layout' },
                React.createElement(Renderer, { spec: layoutRendererSpec, registry }),
              )
            : null,
          React.createElement('div', { id: 'rntme-screen', key: 'screen' },
            React.createElement(Renderer, { spec: screenRendererSpec, registry }),
          ),
        ),
      ),
    ),
  );
}
