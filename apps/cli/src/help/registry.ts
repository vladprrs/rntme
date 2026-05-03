const REGISTRY = new Map<string, string>();

const key = (path: readonly string[]): string => path.join('\x01');

export function registerHelp(path: readonly string[], usage: string): void {
  REGISTRY.set(key(path), usage);
}

export function lookupHelp(path: readonly string[]): string | null {
  return REGISTRY.get(key(path)) ?? null;
}
