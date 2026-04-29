/** IntrospectSession returns canonical `Session`; non-ACTIVE statuses must surface as HTTP 401 at the edge. */

export function inactiveIntrospectSession(rpc: string, value: unknown): boolean {
  if (rpc !== 'IntrospectSession') return false;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return true;

  const status = (value as { status?: unknown }).status;

  const active = status === 1 || status === 'SESSION_STATUS_ACTIVE';

  return !active;
}
