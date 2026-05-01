export type ScopeAlias =
  | { kind: 'entity'; entity: string }
  | {
      kind: 'eventRow';
      aggregateType: string;
      payloadFields: Readonly<Record<string, { type: string; nullable: boolean }>>;
    };
export type ShapeFieldMap = Map<string, { type: string; nullable: boolean }>;

export type Scope = {
  aliases: Map<string, ScopeAlias>;
  shapeFields?: ShapeFieldMap;
};
