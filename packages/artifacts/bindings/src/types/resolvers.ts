import type { Result } from '@rntme/artifact-shared';
import { err, ok } from '@rntme/artifact-shared';
import type { EffectSummary } from '@rntme/graph-ir-compiler';

export const SCALAR_PRIMITIVES = [
  'integer',
  'decimal',
  'string',
  'boolean',
  'date',
  'datetime',
] as const;

export type ScalarPrimitive = (typeof SCALAR_PRIMITIVES)[number];

const scalarPrimitiveSet: ReadonlySet<string> = new Set(SCALAR_PRIMITIVES);

export function isScalarPrimitive(value: string): value is ScalarPrimitive {
  return scalarPrimitiveSet.has(value);
}

/**
 * Canonical parser for the type-string grammar used in graph signatures and
 * shape definitions. Reconciles the two regex copies that previously lived in
 * `@rntme/blueprint`'s `binding-resolvers.ts` and `@rntme/runtime`'s
 * `load-service.ts`.
 *
 * Grammar (no whitespace tolerance — types are author-supplied identifiers,
 * not free-form):
 *
 *   scalar    := 'integer' | 'decimal' | 'string' | 'boolean' | 'date' | 'datetime'
 *   shape     := /^[A-Za-z_][A-Za-z0-9_]*$/
 *   field     := scalar | 'array<' scalar '>'                            // FieldType
 *   input     := scalar | 'list<' scalar '>' | ('row'|'rowset') '<' shape '>'   // InputType
 *   output    := scalar | ('row'|'rowset') '<' shape '>'                 // OutputType
 *
 * Reconciliation notes (see audit catalog Q5):
 *  - Blueprint historically only parsed `scalar` for inputs (its current
 *    service-graph specs don't exercise list/row/rowset inputs). We widen its
 *    `parseInputType` to accept the full input grammar — runtime already does
 *    so, and the `InputType` type permits all four shapes. Pure widening; no
 *    blueprint input ever depended on the narrower reject path.
 *  - `array<>` is field-only; `list<>` is input-only. They are NOT aliases —
 *    they map to different `kind`s (`array` vs `list`). Kept as-is.
 *  - Blueprint returned `null` on failure; runtime threw. Canonical parser
 *    returns `Result<…, ParseError>` so callers choose their failure shape.
 */
export type TypeParseError = {
  readonly category: 'field' | 'input' | 'output';
  readonly raw: string;
  readonly reason: string;
};

const SHAPE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ARRAY_RE = /^array<([a-z]+)>$/;
const LIST_RE = /^list<([a-z]+)>$/;
const ROW_RE = /^(rowset|row)<([A-Za-z_][A-Za-z0-9_]*)>$/;

function parseError(
  category: TypeParseError['category'],
  raw: string,
  reason: string,
): TypeParseError {
  return { category, raw, reason };
}

export function parseScalarType(
  raw: string,
): Result<{ kind: 'scalar'; primitive: ScalarPrimitive }, TypeParseError> {
  return isScalarPrimitive(raw)
    ? ok({ kind: 'scalar' as const, primitive: raw })
    : err([parseError('input', raw, `not a scalar primitive: "${raw}"`)]);
}

export function parseFieldType(
  raw: string,
): Result<FieldType, TypeParseError> {
  if (isScalarPrimitive(raw)) {
    return ok({ kind: 'scalar', primitive: raw });
  }
  const arr = ARRAY_RE.exec(raw);
  if (arr !== null) {
    const element = arr[1]!;
    if (isScalarPrimitive(element)) {
      return ok({ kind: 'array', element });
    }
    return err([
      parseError('field', raw, `array<> element is not a scalar primitive: "${element}"`),
    ]);
  }
  return err([
    parseError('field', raw, `unsupported field type: "${raw}"`),
  ]);
}

export function parseInputType(
  raw: string,
): Result<InputType, TypeParseError> {
  if (isScalarPrimitive(raw)) {
    return ok({ kind: 'scalar', primitive: raw });
  }
  const list = LIST_RE.exec(raw);
  if (list !== null) {
    const element = list[1]!;
    if (isScalarPrimitive(element)) {
      return ok({ kind: 'list', element });
    }
    return err([
      parseError('input', raw, `list<> element is not a scalar primitive: "${element}"`),
    ]);
  }
  const row = ROW_RE.exec(raw);
  if (row !== null) {
    return ok({ kind: row[1] as 'rowset' | 'row', shape: row[2]! });
  }
  return err([
    parseError('input', raw, `unsupported input type: "${raw}"`),
  ]);
}

export function parseOutputType(
  raw: string,
): Result<OutputType, TypeParseError> {
  if (isScalarPrimitive(raw)) {
    return ok({ kind: 'scalar', primitive: raw });
  }
  const row = ROW_RE.exec(raw);
  if (row !== null) {
    return ok({ kind: row[1] as 'rowset' | 'row', shape: row[2]! });
  }
  return err([
    parseError('output', raw, `unsupported output type: "${raw}"`),
  ]);
}

/** Validate a shape identifier (no `<>` wrapping). */
export function isShapeName(value: string): boolean {
  return SHAPE_NAME_RE.test(value);
}

export type FieldType =
  | { kind: 'scalar'; primitive: ScalarPrimitive }
  | { kind: 'array'; element: ScalarPrimitive }
  | { kind: 'json' };

export type ShapeField = { type: FieldType; nullable: boolean };

export type ShapeOrigin = 'custom' | 'pdm' | 'qsm';

export type ResolvedShape = {
  name: string;
  origin: ShapeOrigin;
  fields: Record<string, ShapeField>;
};

export type InputMode = 'required' | 'nullable' | 'defaulted' | 'predicate_optional' | 'root';

export type InputType =
  | { kind: 'scalar'; primitive: ScalarPrimitive }
  | { kind: 'list'; element: ScalarPrimitive }
  | { kind: 'row'; shape: string }
  | { kind: 'rowset'; shape: string };

export type GraphInput = {
  type: InputType;
  mode: InputMode;
  default?: unknown;
};

export type OutputType =
  | { kind: 'rowset'; shape: string }
  | { kind: 'row'; shape: string }
  | { kind: 'scalar'; primitive: ScalarPrimitive };

export type GraphSignature = {
  id: string;
  effects: EffectSummary;
  inputs: Record<string, GraphInput>;
  output: { type: OutputType; from: string };
};

export type BindingResolvers = {
  resolveGraphSignature(graphId: string): GraphSignature | null;
  resolveShape(shapeName: string): ResolvedShape | null;
};
