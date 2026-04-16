/**
 * Registry setup for json-render with shadcn components.
 *
 * This module bridges json-render's catalog/registry system with the
 * rntme runtime's driver (HTTP fetching, navigation, etc.).
 *
 * IMPORTANT: The exact json-render API (defineCatalog, defineRegistry,
 * shadcn catalog import) should be verified against @json-render/react@0.17
 * and @json-render/shadcn@0.17 at implementation time.
 */

export type DriverBridge = {
  navigate: (path: string) => void;
  fetchData: (method: string, path: string, params?: Record<string, unknown>) => Promise<unknown>;
  submitCommand: (method: string, path: string, params: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Create the json-render registry with shadcn components and custom actions.
 *
 * Call this once at app startup. The returned registry is passed to
 * <Renderer spec={spec} registry={registry} />.
 */
export function createRegistry(bridge: DriverBridge) {
  // TODO: Wire up actual json-render registry once dependencies are resolved.
  // The structure will be:
  //
  // return defineRegistry(shadcnCatalog, {
  //   actions: {
  //     navigate: async (params) => bridge.navigate(params.path as string),
  //     fetchData: async (params) => bridge.fetchData(params.method, params.path, params.params),
  //     submitCommand: async (params) => bridge.submitCommand(params.method, params.path, params.params),
  //   },
  // });

  return { bridge };
}
