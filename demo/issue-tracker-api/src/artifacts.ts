import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  BindingResolvers,
  GraphSignature,
  ResolvedShape,
  InputType,
  OutputType,
  InputMode,
  ScalarPrimitive,
} from '@rntme/bindings';

type GraphJson = {
  id: string;
  signature: {
    inputs: Record<string, { type: string; mode: InputMode; default?: unknown }>;
    output: { type: string; from: string };
  };
  nodes: unknown[];
};

type PdmEntity = {
  table: string;
  fields: Record<string, { type: string; nullable: boolean; column: string }>;
  relations: Record<string, unknown>;
  keys: string[];
};

type PdmJson = { entities: Record<string, PdmEntity> };
type ShapesJson = Record<string, { fields: Record<string, { type: string; nullable: boolean }> }>;

const here = dirname(fileURLToPath(import.meta.url));
const artifactsDir = join(here, 'artifacts');

const read = <T>(name: string): T => JSON.parse(readFileSync(join(artifactsDir, name), 'utf8')) as T;

export const pdm = read<PdmJson>('pdm.json');
export const qsm = read<Record<string, unknown>>('qsm.json');
export const bindingsArtifact = read<Record<string, unknown>>('bindings.json');
export const shapes = read<ShapesJson>('shapes.json');

const graphsDir = join(artifactsDir, 'graphs');
const graphFiles = readdirSync(graphsDir).filter((f) => f.endsWith('.json'));
const graphEntries = graphFiles.map((f) => {
  const g = JSON.parse(readFileSync(join(graphsDir, f), 'utf8')) as GraphJson;
  return [g.id, g] as const;
});
const graphsById = Object.fromEntries(graphEntries);

export const graphSpec = {
  version: '1.0-rc7' as const,
  pdmRef: 'issue-tracker.domain.v1',
  qsmRef: 'issue-tracker.read.v1',
  shapes,
  graphs: graphsById,
};

function parseInputType(raw: string): InputType {
  if (raw === 'integer' || raw === 'decimal' || raw === 'string' ||
      raw === 'boolean' || raw === 'date' || raw === 'datetime') {
    return { kind: 'scalar', primitive: raw };
  }
  throw new Error(`Unsupported input type in demo: "${raw}"`);
}

function parseOutputType(raw: string): OutputType {
  const m = /^(rowset|row)<([A-Za-z_][A-Za-z0-9_]*)>$/.exec(raw);
  if (!m) throw new Error(`Unsupported output type: "${raw}"`);
  return { kind: m[1] as 'rowset' | 'row', shape: m[2]! };
}

function toGraphSignature(g: GraphJson): GraphSignature {
  const inputs: GraphSignature['inputs'] = {};
  for (const [name, decl] of Object.entries(g.signature.inputs)) {
    const base = { type: parseInputType(decl.type), mode: decl.mode };
    inputs[name] = decl.default !== undefined ? { ...base, default: decl.default } : base;
  }
  return {
    id: g.id,
    inputs,
    output: { type: parseOutputType(g.signature.output.type), from: g.signature.output.from },
  };
}

function entityToShape(entityName: string, entity: PdmEntity): ResolvedShape {
  const fields: ResolvedShape['fields'] = {};
  for (const [fieldName, decl] of Object.entries(entity.fields)) {
    fields[fieldName] = {
      type: { kind: 'scalar', primitive: decl.type as ScalarPrimitive },
      nullable: decl.nullable,
    };
  }
  return { name: entityName, origin: 'pdm', fields };
}

function customShape(name: string, def: { fields: Record<string, { type: string; nullable: boolean }> }): ResolvedShape {
  const fields: ResolvedShape['fields'] = {};
  for (const [fieldName, f] of Object.entries(def.fields)) {
    fields[fieldName] = {
      type: { kind: 'scalar', primitive: f.type as ScalarPrimitive },
      nullable: f.nullable,
    };
  }
  return { name, origin: 'custom', fields };
}

export const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => {
    const g = graphsById[id];
    return g ? toGraphSignature(g) : null;
  },
  resolveShape: (name) => {
    if (shapes[name]) return customShape(name, shapes[name]);
    const entity = pdm.entities[name];
    if (entity) return entityToShape(name, entity);
    return null;
  },
};
