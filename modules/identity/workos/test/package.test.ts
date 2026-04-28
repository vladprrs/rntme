import { describe, expect, it } from 'vitest';
import packageJson from '../package.json' with { type: 'json' };

describe('package metadata', () => {
  it('pins WorkOS SDK to the Node 20 compatible major', () => {
    expect(packageJson.dependencies['@workos-inc/node']).toBe('^7.82.0');
  });
});
