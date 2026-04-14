import type {
  BindingEntry,
  ResolvedBinding,
  ResolvedBindings,
  StructurallyValid,
} from '../types/artifact.js';
import type { BindingResolvers, ResolvedShape } from '../types/resolvers.js';
import { err, ok, ERROR_CODES, type Result, type BindingsError } from '../types/result.js';

const PLACEHOLDER_SHAPE: ResolvedShape = {
  name: '__placeholder__',
  origin: 'custom',
  fields: {},
};

function resolveBinding(
  id: string,
  entry: BindingEntry,
  resolvers: BindingResolvers,
  errors: BindingsError[],
): ResolvedBinding | null {
  const basePath = `bindings.${id}`;
  const sig = resolvers.resolveGraphSignature(entry.graph);
  if (sig === null) {
    errors.push({
      layer: 'references',
      code: ERROR_CODES.BINDINGS_UNRESOLVED_GRAPH,
      message: `Binding "${id}" references unknown graph "${entry.graph}"`,
      path: `${basePath}.graph`,
    });
    return null;
  }

  // bindTo resolution
  entry.http.parameters.forEach((p, i) => {
    if (!(p.bindTo in sig.inputs)) {
      errors.push({
        layer: 'references',
        code: ERROR_CODES.BINDINGS_UNKNOWN_BIND_TO,
        message: `Parameter "${p.name}" in binding "${id}" binds to unknown input "${p.bindTo}" of graph "${entry.graph}"`,
        path: `${basePath}.http.parameters[${i}].bindTo`,
      });
    }
  });

  // Output shape resolution — only for rowset/row outputs.
  let outputShape = PLACEHOLDER_SHAPE;
  const { output } = sig;
  if (output.type.kind === 'rowset' || output.type.kind === 'row') {
    const shape = resolvers.resolveShape(output.type.shape);
    if (shape === null) {
      errors.push({
        layer: 'references',
        code: ERROR_CODES.BINDINGS_UNRESOLVED_OUTPUT_SHAPE,
        message: `Graph "${entry.graph}" output references unknown shape "${output.type.shape}"`,
        path: `${basePath}.graph`,
      });
      return null;
    }
    outputShape = shape;
  }

  return { entry, signature: sig, outputShape };
}

export function validateReferences(
  artifact: StructurallyValid,
  resolvers: BindingResolvers,
): Result<ResolvedBindings> {
  const errors: BindingsError[] = [];
  const resolved: Record<string, ResolvedBinding> = {};

  for (const [id, entry] of Object.entries(artifact.bindings)) {
    const rb = resolveBinding(id, entry, resolvers, errors);
    if (rb !== null) resolved[id] = rb;
  }

  if (errors.length > 0) return err(errors);
  return ok({ artifact, resolved } as unknown as ResolvedBindings);
}
