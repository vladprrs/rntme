import type { EffectSummary } from '@rntme/graph-ir-compiler';

export type ScalarPrimitive = 'integer' | 'decimal' | 'string' | 'boolean' | 'date' | 'datetime';

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
