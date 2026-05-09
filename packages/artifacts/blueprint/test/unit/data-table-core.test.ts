import { describe, expect, it } from 'vitest';
import { resolveCoreComponent } from '../../src/compose/ui-core-components.js';

describe('DataTable core component', () => {
  it('is registered as a compose-time core primitive', () => {
    const info = resolveCoreComponent('DataTable');
    expect(info).toBeDefined();
    expect(info?.childrenModel).toBe('none');
  });
});
