export type OperationHandler = (params: Record<string, unknown>) => unknown | Promise<unknown>;
export type Unregister = () => void;

export type OperationRegistry = {
  registerComponent(elementId: string, handlers: Record<string, OperationHandler>): Unregister;
  registerModule(moduleName: string, name: string, handler: OperationHandler): void;
  lookupComponent(elementId: string, name: string): OperationHandler | undefined;
  lookupModule(moduleName: string, name: string): OperationHandler | undefined;
};

export function createOperationRegistry(): OperationRegistry {
  const componentHandlers = new Map<string, Map<string, OperationHandler>>();
  const moduleHandlers = new Map<string, Map<string, OperationHandler>>();

  return {
    registerComponent(elementId, handlers) {
      let bucket = componentHandlers.get(elementId);
      if (!bucket) {
        bucket = new Map();
        componentHandlers.set(elementId, bucket);
      }
      const added: string[] = [];
      for (const [name, h] of Object.entries(handlers)) {
        bucket.set(name, h);
        added.push(name);
      }
      return () => {
        const b = componentHandlers.get(elementId);
        if (!b) return;
        for (const n of added) b.delete(n);
        if (b.size === 0) componentHandlers.delete(elementId);
      };
    },
    registerModule(moduleName, name, handler) {
      let bucket = moduleHandlers.get(moduleName);
      if (!bucket) {
        bucket = new Map();
        moduleHandlers.set(moduleName, bucket);
      }
      bucket.set(name, handler);
    },
    lookupComponent(elementId, name) {
      return componentHandlers.get(elementId)?.get(name);
    },
    lookupModule(moduleName, name) {
      return moduleHandlers.get(moduleName)?.get(name);
    },
  };
}
