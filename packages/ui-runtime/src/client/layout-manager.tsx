import * as React from 'react';
import type { CompiledScreen, CompiledSpec } from '@rntme/ui';

export type LayoutManagerProps = {
  layout: CompiledScreen | null;
  screen: CompiledScreen | null;
  renderSpec: (spec: CompiledSpec, key: string) => React.ReactNode;
};

export function LayoutManager({ layout, screen, renderSpec }: LayoutManagerProps): React.ReactElement {
  if (!screen) {
    return React.createElement('div', { id: 'rntme-loading' }, 'Loading...');
  }

  if (!layout) {
    return React.createElement('div', { id: 'rntme-screen' }, renderSpec(screen.spec, 'screen'));
  }

  return React.createElement(
    'div',
    { id: 'rntme-app' },
    React.createElement('div', { id: 'rntme-layout', key: 'layout' }, renderSpec(layout.spec, 'layout')),
    React.createElement('div', { id: 'rntme-screen', key: 'screen' }, renderSpec(screen.spec, 'screen')),
  );
}
