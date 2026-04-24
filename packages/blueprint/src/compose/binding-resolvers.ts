import type {
  BindingResolvers,
  FieldType,
  GraphSignature,
  InputType,
  OutputType,
  ResolvedShape,
  ScalarPrimitive,
} from '@rntme/bindings';
import type { PdmResolver } from '@rntme/pdm';
import type { ServiceGraphSpec } from '../types/artifact.js';
import {
  ERROR_CODES,
  err,
  ok,
  type BlueprintError,
  type Result,
} from '../types/result.js';

const SCALARS: ReadonlySet<ScalarPrimitive> = new Set([
  'integer',
  'decimal',
  'string',
  'boolean',
  'date',
  'datetime',
]);

export function createServiceBindingResolvers(input: {
  serviceSlug: string;
  graphSpec: ServiceGraphSpec;
  pdmResolver: PdmResolver;
}): Result<BindingResolvers> {
  const graphPath = `services/${input.serviceSlug}/graphs`;
  const errors: BlueprintError[] = [];
  const graphSignatures = new Map<string, GraphSignature | null>();
  const customShapes: Record<string, ResolvedShape> = {};

  for (const [shapeName, shape] of Object.entries(input.graphSpec.shapes)) {
    const fields: ResolvedShape['fields'] = {};

    for (const [fieldName, field] of Object.entries(shape.fields)) {
      const parsed = parseFieldType(field.type);
      if (parsed === null) {
        errors.push(graphError(input.serviceSlug, graphPath, field.type));
        continue;
      }
      fields[fieldName] = { type: parsed, nullable: field.nullable };
    }

    customShapes[shapeName] = {
      name: shapeName,
      origin: 'custom',
      fields,
    };
  }

  if (errors.length > 0) return err(errors);

  return ok({
    resolveGraphSignature: (graphId) => {
      if (graphSignatures.has(graphId)) {
        return graphSignatures.get(graphId) ?? null;
      }

      const graph = input.graphSpec.graphs[graphId];
      if (graph === undefined) {
        graphSignatures.set(graphId, null);
        return null;
      }

      const converted = toGraphSignature(input.serviceSlug, graphPath, graph);
      const signature = converted.ok ? converted.value : null;
      graphSignatures.set(graphId, signature);
      return signature;
    },
    resolveShape: (shapeName) =>
      customShapes[shapeName] ??
      resolvePdmShape(shapeName, input.pdmResolver),
  });
}

function parseScalar(raw: string): ScalarPrimitive | null {
  return SCALARS.has(raw as ScalarPrimitive) ? (raw as ScalarPrimitive) : null;
}

function parseInputType(raw: string): InputType | null {
  const scalar = parseScalar(raw);
  if (scalar !== null) return { kind: 'scalar', primitive: scalar };
  return null;
}

function parseFieldType(raw: string): FieldType | null {
  const scalar = parseScalar(raw);
  if (scalar !== null) return { kind: 'scalar', primitive: scalar };

  const array = /^array<([a-z]+)>$/.exec(raw);
  if (array === null) return null;
  const element = parseScalar(array[1]!);
  return element === null ? null : { kind: 'array', element };
}

function parseOutputType(raw: string): OutputType | null {
  const match = /^(rowset|row)<([A-Za-z_][A-Za-z0-9_]*)>$/.exec(raw);
  if (match === null) return null;
  return {
    kind: match[1] as 'rowset' | 'row',
    shape: match[2]!,
  };
}

function toGraphSignature(
  serviceSlug: string,
  graphPath: string,
  graph: ServiceGraphSpec['graphs'][string],
): Result<GraphSignature> {
  const errors: BlueprintError[] = [];
  const inputs: GraphSignature['inputs'] = {};

  for (const [name, declaration] of Object.entries(graph.signature.inputs)) {
    const parsed = parseInputType(declaration.type);
    if (parsed === null) {
      errors.push(graphError(serviceSlug, graphPath, declaration.type));
      continue;
    }

    const base = { type: parsed, mode: declaration.mode };
    inputs[name] =
      declaration.default !== undefined
        ? { ...base, default: declaration.default }
        : base;
  }

  const outputType = parseOutputType(graph.signature.output.type);
  if (outputType === null) {
    errors.push(graphError(serviceSlug, graphPath, graph.signature.output.type));
  }

  if (errors.length > 0) return err(errors);

  const hasEmit = graph.nodes.some(
    (node) =>
      typeof node === 'object' &&
      node !== null &&
      (node as { type?: string }).type === 'emit',
  );

  return ok({
    id: graph.id,
    ...(hasEmit ? { role: 'command' as const } : {}),
    inputs,
    output: {
      type: outputType!,
      from: graph.signature.output.from,
    },
  });
}

function resolvePdmShape(
  shapeName: string,
  pdmResolver: PdmResolver,
): ResolvedShape | null {
  const entity = pdmResolver.resolveEntity(shapeName);
  if (entity === null) return null;

  const fields: ResolvedShape['fields'] = {};
  for (const field of entity.fields) {
    fields[field.name] = {
      type: { kind: 'scalar', primitive: field.type },
      nullable: field.nullable,
    };
  }

  return {
    name: shapeName,
    origin: 'pdm',
    fields,
  };
}

function graphError(
  serviceSlug: string,
  path: string,
  rawType: string,
): BlueprintError {
  return {
    layer: 'service',
    code: ERROR_CODES.BLUEPRINT_SERVICE_GRAPHS_INVALID,
    message: `service "${serviceSlug}" graph type "${rawType}" is unsupported`,
    path,
  };
}
