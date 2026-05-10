import { describe, it, expect } from 'bun:test';
import { VERSION } from '../../src/index.js';

describe('@rntme/bindings-grpc', () => {
  it('exports a VERSION constant', () => {
    expect(typeof VERSION).toBe('string');
  });
});
