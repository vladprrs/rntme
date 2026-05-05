import { describe, expect, it, vi } from 'vitest';
import { createOperationRegistry } from '../../src/operation-registry.js';

describe('OperationRegistry', () => {
  it('registers and looks up component-bound operations by elementId', () => {
    const reg = createOperationRegistry();
    const handler = vi.fn();
    const unregister = reg.registerComponent('editor', { toggleBold: handler });
    expect(reg.lookupComponent('editor', 'toggleBold')).toBe(handler);
    unregister();
    expect(reg.lookupComponent('editor', 'toggleBold')).toBeUndefined();
  });

  it('registers and looks up module-level operations', () => {
    const reg = createOperationRegistry();
    const handler = vi.fn();
    reg.registerModule('@rntme/analytics-google-analytics', 'track', handler);
    expect(reg.lookupModule('@rntme/analytics-google-analytics', 'track')).toBe(handler);
  });

  it('component registrations on the same elementId merge handlers', () => {
    const reg = createOperationRegistry();
    const a = vi.fn();
    const b = vi.fn();
    reg.registerComponent('editor', { toggleBold: a });
    reg.registerComponent('editor', { toggleItalic: b });
    expect(reg.lookupComponent('editor', 'toggleBold')).toBe(a);
    expect(reg.lookupComponent('editor', 'toggleItalic')).toBe(b);
  });

  it('returns undefined for unknown lookups', () => {
    const reg = createOperationRegistry();
    expect(reg.lookupComponent('x', 'y')).toBeUndefined();
    expect(reg.lookupModule('x', 'y')).toBeUndefined();
  });
});
