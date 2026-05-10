import { describe, expect, it } from 'bun:test';
import { render } from '../../../src/stages/render.js';

describe('stages.render', () => {
  it('exports a render function', () => {
    expect(typeof render).toBe('function');
  });
});
