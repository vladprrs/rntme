import type { CompiledScreen } from '@rntme/ui';

export type ScreenLoader = {
  loadScreen: (name: string) => Promise<CompiledScreen>;
  loadLayout: (name: string) => Promise<CompiledScreen>;
};

export function createScreenLoader(fetchFn: typeof fetch = fetch): ScreenLoader {
  const screenCache = new Map<string, CompiledScreen>();
  const layoutCache = new Map<string, CompiledScreen>();

  async function load(url: string, cache: Map<string, CompiledScreen>, key: string): Promise<CompiledScreen> {
    const cached = cache.get(key);
    if (cached) return cached;

    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    const data = (await res.json()) as CompiledScreen;
    cache.set(key, data);
    return data;
  }

  return {
    loadScreen: (name) => load(`/_screens/${name}.json`, screenCache, name),
    loadLayout: (name) => load(`/_layouts/${name}.json`, layoutCache, name),
  };
}
