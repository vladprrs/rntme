import type { ValidatedManifest } from '../manifest/types.js';
import type { CommandExecutor, QueryExecutor } from '@rntme/bindings-http/executor-contract';
import type { ResolvedShape } from '@rntme/bindings';
import { GrpcSurface } from '../plugins/grpc-surface.js';
import type { ValidatedService } from '../types.js';

export function buildGrpcSurface(
  manifest: ValidatedManifest,
  opts: {
    commandExecutor: CommandExecutor;
    queryExecutor: QueryExecutor;
    shapes: Record<string, ResolvedShape>;
  },
): GrpcSurface | null {
  const grpcCfg = manifest.surface?.grpc;
  if (grpcCfg === undefined || grpcCfg.enabled !== true) return null;
  const port = grpcCfg.port ?? 50051;
  const packageName = `rntme.${manifest.service.name.toLowerCase()}.v1`;
  const serviceName = `${toPascal(manifest.service.name)}Service`;
  return new GrpcSurface({
    port,
    packageName,
    serviceName,
    commandExecutor: opts.commandExecutor,
    queryExecutor: opts.queryExecutor,
    shapes: opts.shapes,
  });
}

function toPascal(name: string): string {
  return name
    .split(/[-_\s]/)
    .filter((p) => p.length > 0)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join('');
}

export function collectShapesFromService(service: ValidatedService): Record<string, ResolvedShape> {
  // MVP: union of binding output shapes. Row/rowset inputs are not yet resolved
  // into this registry — add a full shape registry when a real module with
  // row-typed inputs ships (plan 5).
  const acc: Record<string, ResolvedShape> = {};
  for (const resolved of Object.values(service.bindings.resolved)) {
    acc[resolved.outputShape.name] = resolved.outputShape;
  }
  return acc;
}
