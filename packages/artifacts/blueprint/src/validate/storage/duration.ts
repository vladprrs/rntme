const RE = /^(\d+)\s*(ms|s|m|h|d)$/;
const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDurationMs(input: unknown): number | null {
  if (typeof input !== 'string') return null;
  const m = RE.exec(input.trim());
  if (m === null) return null;
  const unitName = m[2];
  if (unitName === undefined) return null;
  const unit = UNIT_MS[unitName];
  if (unit === undefined) return null;
  return Number(m[1]) * unit;
}
