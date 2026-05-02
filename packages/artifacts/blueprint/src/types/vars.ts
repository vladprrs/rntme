export type VarsManifest = Readonly<Record<string, VarBinding>>;

export type VarBinding = Readonly<{
  from: string;
  required: boolean;
}>;

const KNOWN_ROOTS = [
  /^target\.auth\.[a-z][a-z0-9-]*\.[a-zA-Z][a-zA-Z0-9_]*$/,
  /^target\.modules\.[a-z][a-z0-9-]*\.[a-zA-Z][a-zA-Z0-9_]*$/,
  /^target\.eventBus\.[a-zA-Z][a-zA-Z0-9_]*$/,
] as const;

export function isKnownTargetPath(path: string): boolean {
  return KNOWN_ROOTS.some((re) => re.test(path));
}

const PLACEHOLDER_RE = /\$\{([A-Z][A-Z0-9_]*)\}/g;

export function extractPlaceholders(value: unknown): readonly string[] {
  if (typeof value === 'string') {
    const out: string[] = [];
    for (const match of value.matchAll(PLACEHOLDER_RE)) {
      out.push(match[1]!);
    }
    return out;
  }
  if (Array.isArray(value)) return value.flatMap(extractPlaceholders);
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(extractPlaceholders);
  }
  return [];
}
