/** IntrospectSession returns canonical `Session`; non-ACTIVE statuses must surface as HTTP 401 at the edge. */

export function inactiveIntrospectSession(rpc: string, value: unknown): boolean {
  return introspectSessionInactiveReason(rpc, value) !== null;
}

export function introspectSessionInactiveReason(rpc: string, value: unknown): string | null {
  if (rpc !== 'IntrospectSession') return null;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return 'UNKNOWN';

  const session = value as { status?: unknown; vendor_raw?: unknown };
  const status = session.status;

  const active = status === 1 || status === 'SESSION_STATUS_ACTIVE';

  if (active) return null;
  const vendorRaw = session.vendor_raw;
  if (vendorRaw !== null && typeof vendorRaw === 'object' && !Array.isArray(vendorRaw)) {
    const reason = (vendorRaw as { deactivation_reason?: unknown }).deactivation_reason;
    if (typeof reason === 'string' && reason.length > 0) return reason;
  }
  return 'UNKNOWN';
}
