import type { UiResolvers, ResolvedBinding, ResolvedShape, InputType, ShapeField } from '@rntme/ui';
import type {
  ValidatedBindings,
  BindingResolvers,
  ScalarPrimitive,
  InputType as BInputType,
  OutputType as BOutputType,
  GraphInput,
} from '@rntme/bindings';

// ---------------------------------------------------------------------------
// Primitive mapping: bindings ScalarPrimitive → UI primitive
// ---------------------------------------------------------------------------
function mapPrimitive(p: ScalarPrimitive): 'string' | 'number' | 'boolean' {
  if (p === 'integer' || p === 'decimal') return 'number';
  if (p === 'date' || p === 'datetime') return 'string';
  if (p === 'boolean') return 'boolean';
  return 'string'; // 'string' + any future primitives default to string
}

// ---------------------------------------------------------------------------
// Input type mapping
// ---------------------------------------------------------------------------
function mapInputType(t: BInputType): InputType {
  if (t.kind === 'scalar') return { kind: 'scalar', primitive: mapPrimitive(t.primitive) };
  if (t.kind === 'list') return { kind: 'ref', shapeId: `__list__${t.element}` };
  if (t.kind === 'row') return { kind: 'ref', shapeId: t.shape };
  // rowset
  return { kind: 'ref', shapeId: `__rowset__${t.shape}` };
}

// ---------------------------------------------------------------------------
// Shape fields mapping: uses resolveShape to convert Record → Array<ShapeField>
// ---------------------------------------------------------------------------
function mapFields(
  shapeName: string,
  resolveShape: BindingResolvers['resolveShape'],
): ShapeField[] {
  const shape = resolveShape(shapeName);
  if (!shape) return [];
  return Object.entries(shape.fields).map(([name, fieldDef]) => {
    if (!fieldDef) return { name, type: { kind: 'scalar' as const, primitive: 'string' as const } };
    const ft = fieldDef.type;
    let uiType: InputType;
    if (ft.kind === 'scalar') {
      uiType = { kind: 'scalar', primitive: mapPrimitive(ft.primitive) };
    } else {
      // kind === 'array'
      uiType = { kind: 'ref', shapeId: `__array__${ft.element}` };
    }
    const field: ShapeField = { name, type: uiType };
    if (fieldDef.nullable) field.nullable = true;
    return field;
  });
}

// ---------------------------------------------------------------------------
// Output shape mapping: OutputType → UI ResolvedShape
// ---------------------------------------------------------------------------
function mapOutputShape(
  output: BOutputType,
  resolveShape: BindingResolvers['resolveShape'],
): ResolvedShape {
  if (output.kind === 'rowset') {
    const fields = mapFields(output.shape, resolveShape);
    return {
      id: output.shape,
      kind: 'list',
      element: { id: output.shape, kind: 'object', fields },
    };
  }
  if (output.kind === 'row') {
    const fields = mapFields(output.shape, resolveShape);
    return { id: output.shape, kind: 'object', fields };
  }
  // scalar
  return {
    id: '__scalar__',
    kind: 'object',
    fields: [{ name: 'value', type: { kind: 'scalar', primitive: mapPrimitive(output.primitive) } }],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function buildBindingResolver(
  validated: ValidatedBindings,
  resolveShape: BindingResolvers['resolveShape'],
): UiResolvers['resolveBinding'] {
  return (id: string): ResolvedBinding | undefined => {
    const resolved = validated.resolved[id];
    if (!resolved) return undefined;
    const { entry, signature } = resolved;

    // Determine kind: prefer signature.role, fall back to http method
    const kind: 'query' | 'command' =
      signature.role ?? (entry.http.method === 'GET' ? 'query' : 'command');

    // Map inputs: Record<string, GraphInput> → Array with noUncheckedIndexedAccess guards
    const inputs: ResolvedBinding['inputs'] = Object.entries(signature.inputs).flatMap(
      ([name, graphInput]: [string, GraphInput | undefined]) => {
        if (!graphInput) return [];
        return [{ name, type: mapInputType(graphInput.type), mode: graphInput.mode }];
      },
    );

    const outputShape = mapOutputShape(signature.output.type, resolveShape);

    return {
      kind,
      inputs,
      outputShape,
      http: { method: entry.http.method, path: entry.http.path },
    };
  };
}
