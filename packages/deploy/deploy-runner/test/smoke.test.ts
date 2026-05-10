import { describe, expect, it } from 'bun:test';
import * as runner from '../src/index.js';

describe('@rntme/deploy-runner package shape', () => {
  it('loads as ESM', () => {
    expect(typeof runner).toBe('object');
  });
});
