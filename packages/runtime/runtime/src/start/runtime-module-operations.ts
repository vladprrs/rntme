/**
 * Maps canonical module operations to their event-store effect classification.
 *
 * `read` operations may run on the read path with no idempotency guard;
 * `action` operations mutate external state and use optional idempotency. The
 * returned value drives `OperationRegistry.resolve` for module-targeted graph
 * calls — see `start-service.ts` (`buildManifestOperationRegistry`).
 *
 * Returning `null` means the operation is not whitelisted for runtime calls;
 * the registry then refuses to resolve the target and the graph compiler
 * surfaces a missing-module-operation error.
 */
export function runtimeModuleOperationEffect(
  moduleName: string,
  operation: string,
): 'read' | 'action' | null {
  if (moduleName === 'identity-auth0' && operation === 'IntrospectSession') return 'read';
  if (moduleName === 'openrouter' && operation === 'Complete') return 'action';
  if (moduleName === 'storage' && operation === 'GetDownloadUrl') return 'read';
  if (
    moduleName === 'storage' &&
    ['PrepareUpload', 'CommitUpload', 'AbortUpload', 'DeleteFile'].includes(operation)
  ) {
    return 'action';
  }
  if (moduleName === 'storage' && ['GetFile', 'ListFiles'].includes(operation)) return 'read';
  return null;
}
