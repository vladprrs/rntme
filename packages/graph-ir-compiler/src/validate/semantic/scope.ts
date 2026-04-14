export type ScopeAlias = { entity: string };
export type ShapeFieldMap = Map<string, { type: string; nullable: boolean }>;

export type Scope = {
  aliases: Map<string, ScopeAlias>;
  shapeFields?: ShapeFieldMap;
};
