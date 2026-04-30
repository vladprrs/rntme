export type Visible =
  | undefined
  | { $state: string }
  | { $state: string; eq: unknown }
  | { $state: string; contains: unknown }
  | { $state: string; not: true };

export function evaluateVisible(clause: Visible, get: (path: string) => unknown): boolean {
  if (clause === undefined) return true;
  const value = get(clause.$state);
  if ('eq' in clause) return deepEq(value, clause.eq);
  if ('contains' in clause) return contains(value, clause.contains);
  if ('not' in clause) return !truthy(value);
  return truthy(value);
}

function truthy(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (v === '') return false;
  if (v === 0) return false;
  if (v === false) return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

function contains(v: unknown, needle: unknown): boolean {
  if (Array.isArray(v)) return v.some((x) => deepEq(x, needle));
  if (typeof v === 'string' && typeof needle === 'string') return v.includes(needle);
  return false;
}

function deepEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
}
