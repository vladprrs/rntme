import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { resolve } from '../../src/resolve/resolve.js';
import { expand, type ExpandedSource } from '../../src/expand/expand.js';
import { validate, type ValidateResolvers } from '../../src/validate/index.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');

function loadExpanded(name: string): ExpandedSource {
  const r = resolve(join(fixtures, name));
  if (!r.ok) throw new Error(`resolve failed: ${JSON.stringify(r.errors)}`);
  const e = expand(r.value);
  if (!e.ok) throw new Error(`expand failed: ${JSON.stringify(e.errors)}`);
  return e.value;
}

const noopResolvers: ValidateResolvers = {
  resolveBinding: () => undefined,
  resolveComponent: () => ({ childrenModel: 'list', props: {} }),
  resolveRoute: () => true,
  resolveOperation: () => undefined,
  resolveCategoryToModule: () => undefined,
};

describe('validate', () => {
  it('validates a minimal expanded app', () => {
    const expanded = loadExpanded('minimal-app');
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(true);
  });

  it('validates an app with expanded fragments', () => {
    const expanded = loadExpanded('fragment-app');
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(true);
  });

  it('rejects missing root element', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.root = 'nonexistent';
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'MISSING_ROOT')).toBe(true);
  });

  it('rejects orphan elements', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['orphan'] = {
      type: 'Text',
      props: { text: 'lonely' },
    };
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'ORPHAN_ELEMENT')).toBe(true);
  });

  it('rejects bad child references', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['page']!.children = ['nonexistent'];
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'BAD_CHILD_REF')).toBe(true);
  });

  it('accepts layout without Slot element', () => {
    const expanded = loadExpanded('minimal-app');
    const layout = expanded.layouts['main']!;
    const hasSlot = Object.values(layout.spec.elements).some((el) => el.type === 'Slot');
    expect(hasSlot).toBe(false);
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(true);
  });
});

describe('structural — module-action + json-render binding arrays + visible operators', () => {
  it('rejects module-action with both target and module', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      bad: { kind: 'module-action', target: 'a', module: '@rntme/x', name: 'op' },
    };
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'MODULE_ACTION_AMBIGUOUS_ADDRESSING')).toBe(true);
  });

  it('rejects module-action with neither target nor module nor category', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      bad: { kind: 'module-action', name: 'op' },
    };
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'MODULE_ACTION_NEEDS_TARGET_OR_MODULE')).toBe(true);
  });

  it('accepts module-action with target only', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['editor'] = {
      type: 'RichTextEditor',
      props: { value: { $state: '/form/body' } },
    };
    expanded.screens['home']!.spec.elements['page']!.children = ['editor'];
    expanded.screens['home']!.screen.data = {
      '/form/body': { binding: 'x', params: {} },
    };
    expanded.screens['home']!.screen.actions = {
      bold: { kind: 'module-action', target: 'editor', name: 'toggleBold' },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveBinding: () => ({}),
      resolveComponent: (t) =>
        t === 'RichTextEditor'
          ? { childrenModel: 'none', props: { value: { type: 'object', required: true } } }
          : noopResolvers.resolveComponent(t),
      resolveOperation: (name, opts) => {
        if (name === 'toggleBold' && opts.targetElementType === 'RichTextEditor') {
          return { module: '@rntme/tiptap', appliesTo: ['RichTextEditor'], params: {}, category: null };
        }
        return undefined;
      },
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(true);
  });

  it('accepts module-action with category only', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      t: { kind: 'module-action', category: 'analytics', name: 'track', params: { event: 'x' } },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveCategoryToModule: (c) => (c === 'analytics' ? '@rntme/ga' : undefined),
      resolveOperation: (name, opts) => {
        if (name === 'track' && opts.module === '@rntme/ga') {
          return {
            module: '@rntme/ga',
            appliesTo: null,
            params: { event: { type: 'string', required: true } },
            category: 'analytics',
          };
        }
        return undefined;
      },
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(true);
  });

  it('rejects on.press array containing non-binding objects', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['page']!.on = {
      press: [1, { action: 'dispatch', params: { name: 'save' } }] as unknown as Record<
        string,
        unknown
      >,
    };
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'ON_HANDLER_ARRAY_INVALID')).toBe(true);
  });

  it('accepts on.press as a single json-render binding object', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['page']!.on = {
      press: { action: 'dispatch', params: { name: 'save' } },
    };
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(true);
  });

  it('accepts on.press as a json-render binding object array', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['page']!.on = {
      press: [
        { action: 'dispatch', params: { name: 'trackSave' } },
        { action: 'dispatch', params: { name: 'save' } },
      ],
    };
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(true);
  });

  it('accepts visible: { $state: "/x" }', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['page']!.visible = { $state: '/auth/status' };
    expanded.screens['home']!.screen.data = {
      '/auth/status': { binding: 'b', params: {} },
    };
    const r: ValidateResolvers = { ...noopResolvers, resolveBinding: () => ({}) };
    const result = validate(expanded, r);
    expect(result.ok).toBe(true);
  });

  it('accepts visible with eq / contains / not', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['a'] = {
      type: 'Text',
      props: { text: 'a' },
      visible: { $state: '/auth/status', eq: 'anon' },
    };
    expanded.screens['home']!.spec.elements['b'] = {
      type: 'Text',
      props: { text: 'b' },
      visible: { $state: '/roles', contains: 'admin' },
    };
    expanded.screens['home']!.spec.elements['c'] = {
      type: 'Text',
      props: { text: 'c' },
      visible: { $state: '/x', not: true },
    };
    expanded.screens['home']!.spec.elements['page']!.children = ['a', 'b', 'c'];
    expanded.screens['home']!.screen.data = {
      '/auth/status': { binding: 'b1', params: {} },
      '/roles': { binding: 'b2', params: {} },
      '/x': { binding: 'b3', params: {} },
    };
    const r: ValidateResolvers = { ...noopResolvers, resolveBinding: () => ({}) };
    const result = validate(expanded, r);
    expect(result.ok).toBe(true);
  });

  it('rejects visible with unknown operator', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['page']!.visible = {
      $state: '/x',
      badOp: true,
    } as unknown;
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'VISIBLE_OPERATOR_UNKNOWN')).toBe(true);
  });
});

describe('references — module-action lookups', () => {
  it('UNKNOWN_OPERATION when operation not registered', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      t: { kind: 'module-action', category: 'analytics', name: 'nope', params: {} },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveCategoryToModule: () => '@rntme/ga',
      resolveOperation: () => undefined,
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'UNKNOWN_OPERATION')).toBe(true);
  });

  it('MODULE_ACTION_TARGET_MISSING when target element does not exist', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      b: { kind: 'module-action', target: 'missing', name: 'toggleBold' },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveOperation: () => ({
        module: 'm',
        appliesTo: ['RichTextEditor'],
        params: {},
        category: null,
      }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'MODULE_ACTION_TARGET_MISSING')).toBe(true);
  });

  it('MODULE_ACTION_TARGET_TYPE_MISMATCH', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['editor'] = { type: 'Text', props: {} };
    expanded.screens['home']!.spec.elements['page']!.children = ['editor'];
    expanded.screens['home']!.screen.actions = {
      b: { kind: 'module-action', target: 'editor', name: 'toggleBold' },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveOperation: () => ({
        module: 'm',
        appliesTo: ['RichTextEditor'],
        params: {},
        category: null,
      }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'MODULE_ACTION_TARGET_TYPE_MISMATCH')).toBe(true);
  });

  it('MODULE_ACTION_NEEDS_TARGET for component-bound op', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      b: { kind: 'module-action', module: '@rntme/tiptap', name: 'toggleBold' },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveOperation: () => ({
        module: 'm',
        appliesTo: ['RichTextEditor'],
        params: {},
        category: null,
      }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'MODULE_ACTION_NEEDS_TARGET')).toBe(true);
  });

  it('MODULE_ACTION_PARAM_TYPE_MISMATCH', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      t: {
        kind: 'module-action',
        category: 'analytics',
        name: 'track',
        params: { event: 42 as unknown as string },
      },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveCategoryToModule: () => '@rntme/ga',
      resolveOperation: () => ({
        module: '@rntme/ga',
        appliesTo: null,
        params: { event: { type: 'string', required: false } },
        category: 'analytics',
      }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'MODULE_ACTION_PARAM_TYPE_MISMATCH')).toBe(true);
  });

  it('MODULE_ACTION_PARAM_REQUIRED', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      t: { kind: 'module-action', category: 'analytics', name: 'track', params: {} },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveCategoryToModule: () => '@rntme/ga',
      resolveOperation: () => ({
        module: '@rntme/ga',
        appliesTo: null,
        params: { event: { type: 'string', required: true } },
        category: 'analytics',
      }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'MODULE_ACTION_PARAM_REQUIRED')).toBe(true);
  });

  it('CATEGORY_NOT_MAPPED', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      t: { kind: 'module-action', category: 'analytics', name: 'track', params: { event: 'e' } },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveCategoryToModule: () => undefined,
      resolveOperation: () => ({
        module: '@rntme/ga',
        appliesTo: null,
        params: { event: { type: 'string', required: true } },
        category: 'analytics',
      }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'CATEGORY_NOT_MAPPED')).toBe(true);
  });

  it('UNKNOWN_COMPONENT_TYPE', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['x'] = { type: 'UnknownWidget', props: {} };
    expanded.screens['home']!.spec.elements['page']!.children = ['x'];
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveComponent: (t) => (t === 'UnknownWidget' ? undefined : noopResolvers.resolveComponent(t)),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'UNKNOWN_COMPONENT_TYPE')).toBe(true);
  });

  it('PROP_REQUIRED_MISSING', () => {
    const expanded = loadExpanded('minimal-app');
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveComponent: () => ({
        childrenModel: 'list',
        props: { level: { type: 'number', required: true }, subtitle: { type: 'string', required: true } },
      }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'PROP_REQUIRED_MISSING')).toBe(true);
  });

  it('BINDING_KIND_MISMATCH when a data binding resolves to a command binding', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.data = {
      '/issues': { binding: 'createIssue', params: {} },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveBinding: () => ({ kind: 'command' }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'BINDING_KIND_MISMATCH')).toBe(true);
  });

  it('BINDING_KIND_MISMATCH when a command action resolves to a query binding', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      save: { kind: 'command', binding: 'listIssues', paramsFromState: {} },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveBinding: () => ({ kind: 'query' }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'BINDING_KIND_MISMATCH')).toBe(true);
  });

  it('TYPE_MISMATCH when a literal component prop does not match the declared type', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['counter'] = {
      type: 'Counter',
      props: { count: 'five' },
    };
    expanded.screens['home']!.spec.elements['page']!.children = ['counter'];
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveComponent: (type) =>
        type === 'Counter'
          ? { childrenModel: 'none', props: { count: { type: 'number', required: true } } }
          : noopResolvers.resolveComponent(type),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true);
  });

  it('UNCOVERED_INPUT when a command input reads state without a covering source', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      save: {
        kind: 'command',
        binding: 'createIssue',
        paramsFromState: { title: '/missing/title' },
      },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveBinding: () => ({ kind: 'command' }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'UNCOVERED_INPUT')).toBe(true);
  });

  it('accepts repeat.statePath when screen data covers the collection path', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['row'] = {
      type: 'Text',
      props: { text: 'row' },
      repeat: { statePath: '/items' },
    };
    expanded.screens['home']!.spec.elements['page']!.children = ['row'];
    expanded.screens['home']!.screen.data = {
      '/items': { binding: 'listItems', params: {} },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveBinding: () => ({ kind: 'query' }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(true);
  });

  it('UNCOVERED_STATE_PATH for repeat.statePath without a covering data binding', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['row'] = {
      type: 'Text',
      props: { text: 'x' },
      repeat: { statePath: '/items' },
    };
    expanded.screens['home']!.spec.elements['page']!.children = ['row'];
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveBinding: () => ({ kind: 'query' }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const e = result.errors.find((err) => err.code === 'UNCOVERED_STATE_PATH');
    expect(e).toBeDefined();
    expect(e!.path).toBe('screen:home/elements/row/repeat/statePath');
    expect(e!.message).toContain('/items');
  });
});

describe('references — onSuccess validation', () => {
  it('accepts valid command onSuccess.navigateTo', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      save: {
        kind: 'command',
        binding: 'createIssue',
        paramsFromState: {},
        onSuccess: { navigateTo: '/issues' },
      },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveBinding: () => ({ kind: 'command' }),
      resolveRoute: (p) => p === '/issues',
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(true);
  });

  it('UNKNOWN_ONSUCCESS_ROUTE when command onSuccess.navigateTo does not resolve', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      save: {
        kind: 'command',
        binding: 'createIssue',
        paramsFromState: {},
        onSuccess: { navigateTo: '/nowhere' },
      },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveBinding: () => ({ kind: 'command' }),
      resolveRoute: () => false,
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const e = result.errors.find((e) => e.code === 'UNKNOWN_ONSUCCESS_ROUTE');
    expect(e).toBeDefined();
    expect(e!.path).toBe('screen:home/actions/save/onSuccess/navigateTo');
  });

  it('accepts valid command onSuccess.refetchData', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.data = {
      '/issues': { binding: 'listIssues', params: {} },
    };
    expanded.screens['home']!.screen.actions = {
      save: {
        kind: 'command',
        binding: 'createIssue',
        paramsFromState: {},
        onSuccess: { refetchData: ['/issues'] },
      },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveBinding: (id) => (id === 'listIssues' ? { kind: 'query' } : { kind: 'command' }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(true);
  });

  it('UNDECLARED_REFETCH_TARGET when command onSuccess.refetchData points to missing data key', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      save: {
        kind: 'command',
        binding: 'createIssue',
        paramsFromState: {},
        onSuccess: { refetchData: ['/missing'] },
      },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveBinding: () => ({ kind: 'command' }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const e = result.errors.find((e) => e.code === 'UNDECLARED_REFETCH_TARGET');
    expect(e).toBeDefined();
    expect(e!.path).toBe('screen:home/actions/save/onSuccess/refetchData');
  });

  it('accepts valid command onSuccess.clearFormState', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      save: {
        kind: 'command',
        binding: 'createIssue',
        paramsFromState: {},
        onSuccess: { clearFormState: ['/form/title', '/actions/save/status'] },
      },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveBinding: () => ({ kind: 'command' }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(true);
  });

  it('INVALID_FORM_STATE_CLEAR when command onSuccess.clearFormState has bad prefix', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      save: {
        kind: 'command',
        binding: 'createIssue',
        paramsFromState: {},
        onSuccess: { clearFormState: ['/data/title'] },
      },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveBinding: () => ({ kind: 'command' }),
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const e = result.errors.find((e) => e.code === 'INVALID_FORM_STATE_CLEAR');
    expect(e).toBeDefined();
    expect(e!.path).toBe('screen:home/actions/save/onSuccess/clearFormState');
  });

  it('UNKNOWN_ONSUCCESS_ROUTE when module-action onSuccess.navigateTo does not resolve', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.screen.actions = {
      t: {
        kind: 'module-action',
        category: 'analytics',
        name: 'track',
        params: { event: 'e' },
        onSuccess: { navigateTo: '/nowhere' },
      },
    };
    const resolvers: ValidateResolvers = {
      ...noopResolvers,
      resolveCategoryToModule: () => '@rntme/ga',
      resolveOperation: () => ({
        module: '@rntme/ga',
        appliesTo: null,
        params: { event: { type: 'string', required: true } },
        category: 'analytics',
      }),
      resolveRoute: () => false,
    };
    const result = validate(expanded, resolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const e = result.errors.find((e) => e.code === 'UNKNOWN_ONSUCCESS_ROUTE');
    expect(e).toBeDefined();
    expect(e!.path).toBe('screen:home/actions/t/onSuccess/navigateTo');
  });
});
