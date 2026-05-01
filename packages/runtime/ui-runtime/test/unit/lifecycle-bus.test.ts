import { describe, expect, it, vi } from 'vitest';
import { createLifecycleBus } from '../../src/client/lifecycle-bus.js';

describe('LifecycleBus', () => {
  it('emits navigate to subscribers', () => {
    const bus = createLifecycleBus();
    const handler = vi.fn();
    bus.on('navigate', handler);
    bus.emit('navigate', { path: '/x', params: { y: '1' } });
    expect(handler).toHaveBeenCalledWith({ path: '/x', params: { y: '1' } });
  });

  it('unsubscribes', () => {
    const bus = createLifecycleBus();
    const handler = vi.fn();
    const off = bus.on('action:dispatched', handler);
    off();
    bus.emit('action:dispatched', { actionId: 'save', kind: 'command', params: {} });
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not throw when no subscribers', () => {
    const bus = createLifecycleBus();
    expect(() => bus.emit('navigate', { path: '/', params: {} })).not.toThrow();
  });
});
