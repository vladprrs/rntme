import { describe, expect, it } from 'bun:test';
import { runMarketingSiteConformance } from '../src/index.js';

describe('runMarketingSiteConformance', () => {
  it('exports a conformance runner', () => {
    expect(runMarketingSiteConformance).toBeTypeOf('function');
  });
});
