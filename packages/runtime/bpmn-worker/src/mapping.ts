import type { WorkflowMappingValue } from '@rntme/workflows';

export type MappingContext = {
  readonly event: unknown;
  readonly process: unknown;
};

export function evaluateMappingValue(value: WorkflowMappingValue, ctx: MappingContext): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('$event.')) return readPath(ctx.event, value.slice('$event.'.length));
    if (value.startsWith('$process.')) return readPath(ctx.process, value.slice('$process.'.length));
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => evaluateMappingValue(item, ctx));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, evaluateMappingValue(nested, ctx)]),
    );
  }
  return value;
}

function readPath(source: unknown, path: string): unknown {
  let current = source;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    if (isBlockedPathSegment(segment)) return undefined;
    if (!Object.hasOwn(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function isBlockedPathSegment(segment: string): boolean {
  return segment === '__proto__' || segment === 'constructor' || segment === 'prototype';
}
