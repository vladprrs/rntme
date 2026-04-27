export function timestamp(value: unknown): { seconds: number; nanos: number } | undefined {
  const millis = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(millis)) return undefined;
  return {
    seconds: Math.floor(millis / 1000),
    nanos: (millis % 1000) * 1_000_000,
  };
}
