// @vitest-environment happy-dom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { RegistryProvider, useModuleAction } from '../../src/hooks.js';
import { createOperationRegistry } from '../../src/operation-registry.js';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('useModuleAction', () => {
  it('returns an async callable that dispatches module operations with params', async () => {
    const registry = createOperationRegistry();
    const handler = vi.fn();
    registry.registerModule('@rntme/test-module', 'save', handler);

    let save: ((params?: Record<string, unknown>) => Promise<void>) | undefined;

    function Probe() {
      save = useModuleAction('@rntme/test-module', 'save');
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

    await save?.({ id: 'note-1' });

    expect(handler).toHaveBeenCalledWith({ id: 'note-1' });
  });

  it('no-ops when there is no registry or handler', async () => {
    let login: ((params?: Record<string, unknown>) => Promise<void>) | undefined;

    function Probe() {
      login = useModuleAction('@rntme/missing', 'login');
      return React.createElement('div');
    }

    const target = document.createElement('div');
    document.body.appendChild(target);
    const root = createRoot(target);

    await act(async () => {
      root.render(React.createElement(Probe));
    });

    await expect(login?.()).resolves.toBeUndefined();
  });
});
