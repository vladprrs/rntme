import { describe, it, expect } from 'vitest';
import { validateStructural } from '../../../../src/validate/structural/index.js';
import { commercePdm, commerceQsm } from '../../../fixtures/validated-commerce.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

describe('structural validator — findMany { eventType }', () => {
  it('accepts a findMany with eventType source and reduce', () => {
    const spec: AuthoringSpecOutput = {
      version: '1.0-rc7',
      pdmRef: 'p',
      qsmRef: 'q',
      shapes: {
        R: { fields: { n: { type: 'integer', nullable: false } } },
      },
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: {},
            output: { type: 'rowset<R>', from: 'r' },
          },
          nodes: [
            { id: 's', type: 'findMany', config: { source: { eventType: 'X' } } },
            {
              id: 'r',
              type: 'reduce',
              config: {
                input: 's',
                into: 'R',
                group: {},
                measures: { n: { fn: 'count' } },
              },
            },
          ],
        },
      },
    };
    const r = validateStructural(spec, commercePdm, commerceQsm);
    expect(r.ok).toBe(true);
  });
});
