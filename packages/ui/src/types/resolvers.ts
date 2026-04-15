import type { z } from 'zod';

export type InputMode = 'root' | 'required' | 'nullable' | 'defaulted' | 'predicate_optional';

export type InputType =
  | { kind: 'scalar'; primitive: 'string' | 'number' | 'boolean' }
  | { kind: 'enum'; variants: readonly string[] }
  | { kind: 'ref'; shapeId: string };

export type ShapeField = { name: string; type: InputType; nullable?: boolean };

export type ResolvedShape = {
  id: string;
  kind: 'object' | 'list';
  element?: ResolvedShape;
  fields?: ShapeField[];
};

export type ResolvedBinding = {
  kind: 'query' | 'command';
  inputs: Array<{ name: string; type: InputType; mode: InputMode }>;
  outputShape: ResolvedShape;
  http: { method: 'GET' | 'POST'; path: string };
};

export type ResolvedComponent = {
  propsSchema: z.ZodTypeAny;
  childrenModel: 'none' | 'list';
  knownListProps?: readonly string[];
};

export interface UiResolvers {
  resolveBinding(bindingId: string): ResolvedBinding | undefined;
  resolveComponent(type: string): ResolvedComponent | undefined;
  resolveRoute(path: string): boolean;
}
