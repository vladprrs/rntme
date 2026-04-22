export function sanitizeToProtoIdent(raw: string): string {
  let out = raw.replace(/[^A-Za-z0-9_]/g, '_');
  if (/^[0-9]/.test(out)) out = `_${out}`;
  return out;
}

export function camelToPascal(s: string): string {
  if (s.length === 0) return s;
  return s[0]!.toUpperCase() + s.slice(1);
}

export function bindingIdToRpcName(bindingId: string): string {
  const sanitized = sanitizeToProtoIdent(bindingId);
  return sanitized
    .split('_')
    .filter((p) => p.length > 0)
    .map(camelToPascal)
    .join('');
}

export function shapeNameToMessageName(shapeName: string): string {
  return bindingIdToRpcName(shapeName);
}
