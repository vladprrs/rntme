import type { WorkflowArtifact } from '@rntme/workflows';

export type NativeHandlerInput = Readonly<Record<string, unknown>>;
export type NativeHandlerProcessVariables = Readonly<Record<string, unknown>>;

export type NativeHandlerFn = (
  input: NativeHandlerInput,
  processVariables: NativeHandlerProcessVariables,
) => Promise<unknown>;

export type NativeHandlerKey = string; // `${definition}.${taskId}`

export class NativeHandlerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'NativeHandlerError';
  }
}

export type ResolveNativeHandlersInput = {
  readonly manifest: WorkflowArtifact;
  readonly importModule?: (specifier: string) => Promise<Record<string, unknown>>;
};

export async function resolveNativeHandlers(
  input: ResolveNativeHandlersInput,
): Promise<Map<NativeHandlerKey, NativeHandlerFn>> {
  const importer = input.importModule ?? ((spec: string) => import(spec));
  const map = new Map<NativeHandlerKey, NativeHandlerFn>();
  const moduleCache = new Map<string, Record<string, unknown>>();

  for (const native of input.manifest.nativeTasks ?? []) {
    const cached = moduleCache.get(native.handler.module);
    let mod: Record<string, unknown>;
    if (cached === undefined) {
      try {
        mod = await importer(native.handler.module);
      } catch (cause) {
        throw new NativeHandlerError(
          'WORKFLOW_NATIVE_HANDLER_MODULE_LOAD_FAILED',
          `could not import handler module "${native.handler.module}": ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
        );
      }
      moduleCache.set(native.handler.module, mod);
    } else {
      mod = cached;
    }
    const fn = mod[native.handler.export];
    if (typeof fn !== 'function') {
      throw new NativeHandlerError(
        'WORKFLOW_NATIVE_HANDLER_MISSING_EXPORT',
        `handler module "${native.handler.module}" does not export "${native.handler.export}"`,
      );
    }
    map.set(`${native.definition}.${native.taskId}`, fn as NativeHandlerFn);
  }
  return map;
}
