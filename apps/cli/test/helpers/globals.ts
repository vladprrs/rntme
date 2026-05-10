const originals = new Map<
  string,
  { existed: true; descriptor: PropertyDescriptor } | { existed: false }
>();

export function stubGlobal(name: string, value: unknown): void {
  if (!originals.has(name)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    originals.set(name, descriptor ? { existed: true, descriptor } : { existed: false });
  }
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

export function restoreGlobals(): void {
  for (const [name, original] of originals) {
    if (original.existed) {
      Object.defineProperty(globalThis, name, original.descriptor);
    } else {
      delete (globalThis as Record<string, unknown>)[name];
    }
  }
  originals.clear();
}
