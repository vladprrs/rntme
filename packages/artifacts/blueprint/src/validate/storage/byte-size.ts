const RE = /^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i;
const UNIT_BYTES: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
};

export function parseBytes(input: unknown): number | null {
  if (typeof input === 'number' && Number.isInteger(input) && input > 0) return input;
  if (typeof input !== 'string') return null;
  const m = RE.exec(input.trim());
  if (m === null) return null;
  const unit = (m[2] ?? 'B').toUpperCase();
  const multiplier = UNIT_BYTES[unit];
  if (multiplier === undefined) return null;
  return Math.floor(Number(m[1]) * multiplier);
}
