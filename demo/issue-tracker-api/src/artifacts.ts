import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
  isErr,
  type PdmResolver,
  type ValidatedPdm,
} from '@rntme/pdm';
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

type ShapesJson = Record<string, { fields: Record<string, { type: string; nullable: boolean }> }>;

const here = dirname(fileURLToPath(import.meta.url));
const artifactsDir = join(here, 'artifacts');

const readText = (name: string): string => readFileSync(join(artifactsDir, name), 'utf8');
const readJson = <T>(name: string): T => JSON.parse(readText(name)) as T;

const pdmParsed = parsePdm(readText('pdm.json'));
if (isErr(pdmParsed)) {
  throw new Error(`PDM parse failed: ${JSON.stringify(pdmParsed.errors, null, 2)}`);
}
const pdmValidated = validatePdm(pdmParsed.value);
if (isErr(pdmValidated)) {
  throw new Error(`PDM validation failed: ${JSON.stringify(pdmValidated.errors, null, 2)}`);
}
export const pdmResolver: PdmResolver = createPdmResolver(pdmValidated.value);

/**
 * PDM exported for use by graph-ir-compiler (via createBindingsRouter).
 * graph-ir-compiler uses a strict Zod schema, so `generated` and `stateMachine`
 * fields must be stripped before passing. We project the validated PDM to only
 * include `table`, `fields` (type/nullable/column only), `relations`, and `keys`.
 * Typed as ValidatedPdm so existing callers that read `pdm.entities` still work.
 */
function stripForCompiler(validated: ValidatedPdm): ValidatedPdm {
  const entities: Record<string, unknown> = {};
  for (const [entityName, entity] of Object.entries(validated.entities)) {
    const fields: Record<string, unknown> = {};
    for (const [fieldName, field] of Object.entries(entity.fields)) {
      fields[fieldName] = { type: field.type, nullable: field.nullable, column: field.column };
    }
    entities[entityName] = {
      table: entity.table,
      fields,
      relations: entity.relations ?? {},
      keys: entity.keys,
    };
  }
  return { entities } as unknown as ValidatedPdm;
}

// TODO(follow-up/graph-ir-compiler-schema): remove stripForCompiler once graph-ir-compiler's
// PdmSchema accepts the `generated` field on Field and the `stateMachine` block on Entity.
// Once that lands, replace with: export const pdm: ValidatedPdm = pdmValidated.value;
export const pdm: ValidatedPdm = stripForCompiler(pdmValidated.value);

export const qsm = readJson<Record<string, unknown>>('qsm.json');
export const bindingsArtifact = readJson<Record<string, unknown>>('bindings.json');
export const shapes = readJson<ShapesJson>('shapes.json');

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
  if (
    raw === 'integer' || raw === 'decimal' || raw === 'string' ||
    raw === 'boolean' || raw === 'date' || raw === 'datetime'
  ) {
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

function entityToShape(entityName: string): ResolvedShape | null {
  const e = pdmResolver.resolveEntity(entityName);
  if (!e) return null;
  const fields: ResolvedShape['fields'] = {};
  for (const f of e.fields) {
    fields[f.name] = {
      type: { kind: 'scalar', primitive: f.type as ScalarPrimitive },
      nullable: f.nullable,
    };
  }
  return { name: entityName, origin: 'pdm', fields };
}

function customShape(
  name: string,
  def: { fields: Record<string, { type: string; nullable: boolean }> },
): ResolvedShape {
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
    return entityToShape(name);
  },
};
