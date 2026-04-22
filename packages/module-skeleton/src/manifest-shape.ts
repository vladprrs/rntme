/**
 * Minimal manifest shape for platform modules.
 *
 * This is intentionally a placeholder — plan 2 (gRPC surface) will extend
 * it with `protoPath`, `grpcPort`, and module-specific fields.
 */
export type ModuleManifest = {
  name: string;
  version: string;
  description?: string;
};
