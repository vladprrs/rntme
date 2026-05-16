import {
  parseFieldType,
  parseInputType,
  parseOutputType,
  type BindingResolvers,
  type GraphSignature,
  type ResolvedShape,
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
      if (!parsed.ok) {
        errors.push(graphError(input.serviceSlug, graphPath, field.type));
        continue;
      }
      fields[fieldName] = { type: parsed.value, nullable: field.nullable };
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

function toGraphSignature(
  serviceSlug: string,
  graphPath: string,
  graph: ServiceGraphSpec['graphs'][string],
): Result<GraphSignature> {
  const errors: BlueprintError[] = [];
  const inputs: GraphSignature['inputs'] = {};

  for (const [name, declaration] of Object.entries(graph.signature.inputs)) {
    const parsed = parseInputType(declaration.type);
    if (!parsed.ok) {
      errors.push(graphError(serviceSlug, graphPath, declaration.type));
      continue;
    }

    const base = { type: parsed.value, mode: declaration.mode };
    inputs[name] =
      declaration.default !== undefined
        ? { ...base, default: declaration.default }
        : base;
  }

  const outputParsed = parseOutputType(graph.signature.output.type);
  if (!outputParsed.ok) {
    errors.push(graphError(serviceSlug, graphPath, graph.signature.output.type));
  }

  if (errors.length > 0 || !outputParsed.ok) {
    return err(errors);
  }

  const emitNodes = graph.nodes.filter(
    (node) => typeof node === 'object' && node !== null && (node as { type?: string }).type === 'emit',
  );

  return ok({
    id: graph.id,
    inputs,
    output: {
      type: outputParsed.value,
      from: graph.signature.output.from,
    },
    effects: {
      localReads: true,
      localEmits: emitNodes.map((node) => {
        const config = (node as { config?: { aggregate?: unknown; transition?: unknown } }).config;
        return {
          aggregate: typeof config?.aggregate === 'string' ? config.aggregate : '',
          transition: typeof config?.transition === 'string' ? config.transition : '',
          eventType: '',
        };
      }),
      calls: [],
      waits: false,
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
