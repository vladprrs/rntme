import { describe, expect, it } from 'bun:test';
import { resolveCoreComponent } from '../../src/compose/ui-core-components.js';

describe('generic Table core component', () => {
  it('is registered as a compose-time base primitive', () => {
    const info = resolveCoreComponent('Table');
    expect(info).toBeDefined();
    expect(info?.childrenModel).toBe('none');
  });

  it('does not treat platform product components as core components', () => {
    expect(resolveCoreComponent('DataTable')).toBeUndefined();
    expect(resolveCoreComponent('PageHeader')).toBeUndefined();
    expect(resolveCoreComponent('PlatformDataTable')).toBeUndefined();
  });
});
