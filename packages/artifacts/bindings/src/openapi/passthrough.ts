function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepMerge(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...left };
  for (const [key, rightValue] of Object.entries(right)) {
    const leftValue = result[key];
    if (isPlainObject(leftValue) && isPlainObject(rightValue)) {
      result[key] = deepMerge(leftValue, rightValue);
    } else {
      result[key] = rightValue;
    }
  }
  return result;
}
