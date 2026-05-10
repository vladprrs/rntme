import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { resolve } from '../../src/resolve/resolve.js';
import { expand, type ExpandedSource } from '../../src/expand/expand.js';
import { validate, type ValidateResolvers } from '../../src/validate/index.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');

function loadExpanded(name: string): ExpandedSource {
  const resolved = resolve(join(fixtures, name));
  if (!resolved.ok) throw new Error(`resolve failed: ${JSON.stringify(resolved.errors)}`);
  const expanded = expand(resolved.value);
  if (!expanded.ok) throw new Error(`expand failed: ${JSON.stringify(expanded.errors)}`);
  return expanded.value;
}

const resolvers: ValidateResolvers = {
  resolveBinding: () => undefined,
  resolveComponent: () => ({ childrenModel: 'list', props: {} }),
  resolveRoute: () => true,
  resolveOperation: () => undefined,
  resolveCategoryToModule: () => undefined,
  resolveStorageRoute: (routeId) => (routeId === 'attachments' ? 'Ticket' : undefined),
};

describe('storage route references', () => {
  it('accepts known storage route ids on storage components', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements.upload = {
      type: 'UploadDropzone',
      props: { routeId: 'attachments', entityId: { $state: '/route/params/id' } },
    };
    expanded.screens['home']!.spec.elements.page!.children = ['upload'];

    const result = validate(expanded, resolvers);

    expect(result.ok).toBe(true);
  });

  it('rejects unknown literal storage route ids on storage components', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements.files = {
      type: 'FileList',
      props: { routeId: 'missing-route', entityId: { $state: '/route/params/id' } },
    };
    expanded.screens['home']!.spec.elements.page!.children = ['files'];

    const result = validate(expanded, resolvers);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'UI_REFERENCES_UNKNOWN_STORAGE_ROUTE',
        message: 'component "FileList" references unknown storage route "missing-route"',
      }),
    );
  });
});
