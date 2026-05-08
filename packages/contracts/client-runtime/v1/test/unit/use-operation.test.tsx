// @vitest-environment happy-dom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { RegistryProvider, useOperation } from '../../src/hooks.js';
import { createOperationRegistry } from '../../src/operation-registry.js';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('useOperation', () => {
  it('returns module operation results', async () => {
    const registry = createOperationRegistry();
    registry.registerModule('@rntme/test-module', 'load', async () => ({ id: 'note-1' }));

    let load: (() => Promise<{ id: string }>) | undefined;

    function Probe() {
      load = useOperation<{ id: string }>('@rntme/test-module', 'load');
      return React.createElement('div');
    }

    const target = document.createElement('div');
    document.body.appendChild(target);
    const root = createRoot(target);

    await act(async () => {
      root.render(
        React.createElement(
          RegistryProvider,
          { value: registry },
          React.createElement(Probe),
        ),
      );
    });

    await expect(load?.()).resolves.toEqual({ id: 'note-1' });
  });

  it('returns undefined when no registry or handler exists', async () => {
    let missing: (() => Promise<unknown>) | undefined;

    function Probe() {
      missing = useOperation('@rntme/missing', 'load');
      return React.createElement('div');
    }

    const target = document.createElement('div');
    document.body.appendChild(target);
    const root = createRoot(target);

    await act(async () => {
      root.render(React.createElement(Probe));
    });

    await expect(missing?.()).resolves.toBeUndefined();
  });
});
