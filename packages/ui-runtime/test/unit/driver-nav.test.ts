/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { createUiDriver } from '../../src/client/driver.js';
import { createStateStore } from '../../src/client/state-store.js';
import { artifact } from '../fixtures/validated-artifact.js';
import type { ValidatedUiArtifact } from '@rntme/ui';

const withNav = JSON.parse(JSON.stringify(artifact));
withNav.routes['/a'].actions = {
  open: { kind: 'navigation', navigateTo: '/detail/:id', paramsFromState: { id: '/row/id' } },
};
withNav.routes['/detail/:id'] = {
  page: { root: 'n', elements: { n: { type: 'Stack', props: {}, children: [] } } },
};

describe('driver.navigation', () => {
  it('expands navigateTo and emits a navigation event', async () => {
    const store = createStateStore();
    store.set('/row/id', '42');
    const onNavigate = vi.fn();
    const driver = createUiDriver({
      artifact: withNav as ValidatedUiArtifact,
      bindingsHttpBaseUrl: '',
      fetch: vi.fn() as unknown as typeof fetch,
      stateStore: store,
      bindingHttpByName: {},
      onNavigate,
    });
    await driver.invokeAction('/a', 'open');
    expect(onNavigate).toHaveBeenCalledWith('/detail/42');
  });
});
