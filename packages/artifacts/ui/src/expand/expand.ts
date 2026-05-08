import { ok, err, type Result, type UiError } from '../types/result.js';
import {
  isRefElement,
  type ResolvedSource,
  type SpecJson,
  type RefElement,
} from '../types/source.js';
import type { CompiledElement } from '../types/compiled.js';

export type ExpandedSource = Omit<ResolvedSource, 'fragments' | 'layouts' | 'screens'> & {
  layouts: Record<string, { spec: { root: string; elements: Record<string, CompiledElement> }; screen: ResolvedSource['layouts'][string]['screen'] }>;
  screens: Record<string, { spec: { root: string; elements: Record<string, CompiledElement> }; screen: ResolvedSource['screens'][string]['screen'] }>;
  fragments: ResolvedSource['fragments'];
};

/**
 * Deep-walk a value tree, replacing { $param: "name" } with the bound value.
 */
function substituteParams(value: unknown, bindings: Record<string, unknown>): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => substituteParams(v, bindings));

  const obj = value as Record<string, unknown>;
  if ('$param' in obj && typeof obj['$param'] === 'string') {
    const paramName = obj['$param'];
    if (!(paramName in bindings)) return obj; // unbound — will be caught by validation
    return bindings[paramName];
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = substituteParams(v, bindings);
  }
  return out;
}

/**
 * Inline a single $ref element: load fragment, prefix IDs, substitute $param,
 * return the new elements map and the inlined root key.
 */
function inlineFragment(
  refKey: string,
  ref: RefElement,
  fragments: Map<string, SpecJson>,
  errors: UiError[],
): { rootKey: string; elements: Record<string, CompiledElement> } | null {
  const fragmentSpec = fragments.get(ref.$ref);
  if (!fragmentSpec) {
    errors.push({ code: 'FILE_NOT_FOUND', message: `Fragment not found: ${ref.$ref}`, path: ref.$ref });
    return null;
  }

  const prefix = `${refKey}__`;
  const elements: Record<string, CompiledElement> = {};

  for (const [elKey, el] of Object.entries(fragmentSpec.elements)) {
    if (isRefElement(el)) {
      // Nested $ref inside fragment — recursively inline
      const nested = inlineFragment(`${prefix}${elKey}`, el, fragments, errors);
      if (!nested) continue;
      for (const [nk, nv] of Object.entries(nested.elements)) {
        elements[nk] = nv;
      }
      continue;
    }

    const prefixedKey = `${prefix}${elKey}`;
    const substitutedProps = substituteParams(el.props, ref.bind) as Record<string, unknown>;

    // Prefix children references, handling nested $ref children
    const prefixedChildren = (el.children ?? []).map((childId) => {
      const childEl = fragmentSpec.elements[childId];
      if (childEl && isRefElement(childEl)) {
        // This child is a nested $ref — point to its inlined root
        const nestedSpec = fragments.get(childEl.$ref);
        if (nestedSpec) {
          return `${prefix}${childId}__${nestedSpec.root}`;
        }
      }
      return `${prefix}${childId}`;
    });

    const compiled: CompiledElement = {
      type: el.type,
      props: substitutedProps,
    };
    if (prefixedChildren.length > 0) compiled.children = prefixedChildren;
    if (el.visible !== undefined) compiled.visible = substituteParams(el.visible, ref.bind);
    if (el.on) compiled.on = substituteParams(el.on, ref.bind) as Record<string, unknown>;
    if (el.watch) compiled.watch = substituteParams(el.watch, ref.bind) as Record<string, unknown>;
    if (el.repeat) compiled.repeat = el.repeat;

    elements[prefixedKey] = compiled;
  }

  return { rootKey: `${prefix}${fragmentSpec.root}`, elements };
}

/**
 * Expand a single spec: convert all elements to CompiledElement form,
 * inlining any $ref elements and rewiring parent children arrays.
 */
function expandSpec(
  spec: SpecJson,
  fragments: Map<string, SpecJson>,
  errors: UiError[],
): { root: string; elements: Record<string, CompiledElement> } {
  const elements: Record<string, CompiledElement> = {};

  // First pass: copy non-$ref elements as CompiledElements
  for (const [key, el] of Object.entries(spec.elements)) {
    if (isRefElement(el)) continue;

    const compiled: CompiledElement = {
      type: el.type,
      props: el.props,
    };
    if (el.children && el.children.length > 0) compiled.children = [...el.children];
    if (el.visible !== undefined) compiled.visible = el.visible;
    if (el.on) compiled.on = el.on;
    if (el.watch) compiled.watch = el.watch;
    if (el.repeat) compiled.repeat = el.repeat;

    elements[key] = compiled;
  }

  // Second pass: inline $ref elements and rewire parent children
  for (const [key, el] of Object.entries(spec.elements)) {
    if (!isRefElement(el)) continue;

    const inlined = inlineFragment(key, el, fragments, errors);
    if (!inlined) continue;

    // Merge inlined elements into the elements map
    for (const [ik, iv] of Object.entries(inlined.elements)) {
      elements[ik] = iv;
    }

    // Rewire any parent that references this $ref key in its children
    for (const parent of Object.values(elements)) {
      if (!parent.children) continue;
      const idx = parent.children.indexOf(key);
      if (idx !== -1) {
        parent.children[idx] = inlined.rootKey;
      }
    }
  }

  return { root: spec.root, elements };
}

export function expand(resolved: ResolvedSource): Result<ExpandedSource> {
  const errors: UiError[] = [];

  const layouts: ExpandedSource['layouts'] = {};
  for (const [name, layout] of Object.entries(resolved.layouts)) {
    layouts[name] = {
      spec: expandSpec(layout.spec, resolved.fragments, errors),
      screen: layout.screen,
    };
  }

  const screens: ExpandedSource['screens'] = {};
  for (const [name, screen] of Object.entries(resolved.screens)) {
    screens[name] = {
      spec: expandSpec(screen.spec, resolved.fragments, errors),
      screen: screen.screen,
    };
  }

  if (errors.length > 0) return err(errors);

  return ok({
    manifest: resolved.manifest,
    baseDir: resolved.baseDir,
    layouts,
    screens,
    fragments: resolved.fragments,
  });
}
