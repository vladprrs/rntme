import { describe, expect, it } from 'vitest';
import { validateUi } from '@rntme/ui';
import { buildBindingResolver, buildComponentResolver } from '@rntme/ui-runtime';
import { ui } from '../src/ui.js';
import { resolvers as bindingsResolvers, bindingsArtifact } from '../src/artifacts.js';
import {
  parseBindingArtifact,
  validateBindings,
} from '@rntme/bindings';

describe('demo ui.ts validateUi', () => {
  it('passes the 4-layer validator against the demo bindings', () => {
    const parsed = parseBindingArtifact(bindingsArtifact);
    if (!parsed.ok) throw new Error('parse: ' + JSON.stringify(parsed.errors));
    const v = validateBindings(parsed.value, bindingsResolvers);
    if (!v.ok) throw new Error('bindings: ' + JSON.stringify(v.errors));
    const res = validateUi(ui, {
      resolveBinding: buildBindingResolver(v.value, bindingsResolvers.resolveShape),
      resolveComponent: buildComponentResolver(),
      resolveRoute: (p) => {
        if (p in ui.routes) return true;
        const segs = p.split('/').filter(Boolean);
        return Object.keys(ui.routes).some((pattern) => {
          const ps = pattern.split('/').filter(Boolean);
          if (ps.length !== segs.length) return false;
          for (let i = 0; i < ps.length; i++) {
            const a = ps[i];
            const b = segs[i];
            if (a === undefined || b === undefined) return false;
            if (a.startsWith(':')) continue;
            if (a !== b) return false;
          }
          return true;
        });
      },
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(res.errors);
    }
    expect(res.ok).toBe(true);
  });
});
