import type { ValidatedManifest } from '../manifest/types.js';
import type { CommandExecutor, QueryExecutor } from '@rntme/bindings-http/executor-contract';
import type { ResolvedShape, ScalarPrimitive } from '@rntme/bindings';
import { createPdmResolver } from '@rntme/pdm';
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
  const packageName = `rntme.${manifest.service.name.toLowerCase().replace(/-/g, '_')}.v1`;
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
  const acc: Record<string, ResolvedShape> = {};
  const addShape = (shapeName: string): void => {
    if (acc[shapeName] !== undefined) return;
    const shape = resolveServiceShape(service, shapeName);
    if (shape !== null) acc[shapeName] = shape;
  };

  for (const resolved of Object.values(service.bindings.resolved)) {
    acc[resolved.outputShape.name] = resolved.outputShape;
    for (const input of Object.values(resolved.signature.inputs)) {
      if (input.type.kind === 'row' || input.type.kind === 'rowset') {
        addShape(input.type.shape);
      }
    }
  }
  return acc;
}

function resolveServiceShape(service: ValidatedService, name: string): ResolvedShape | null {
  const custom = service.graphSpec.shapes[name];
  if (custom !== undefined) {
    const fields: ResolvedShape['fields'] = {};
    for (const [fieldName, field] of Object.entries(custom.fields)) {
      fields[fieldName] = {
        type: { kind: 'scalar', primitive: field.type as ScalarPrimitive },
        nullable: field.nullable,
      };
    }
    return { name, origin: 'custom', fields };
  }

  const entity = createPdmResolver(service.pdm).resolveEntity(name);
  if (entity === null) return null;
  const fields: ResolvedShape['fields'] = {};
  for (const field of entity.fields) {
    fields[field.name] = {
      type: { kind: 'scalar', primitive: field.type as ScalarPrimitive },
      nullable: field.nullable,
    };
  }
  return { name, origin: 'pdm', fields };
}
