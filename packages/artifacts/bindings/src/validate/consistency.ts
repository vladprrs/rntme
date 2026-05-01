import {
  bindAsName,
  bindAsPick,
  type BindingEntry,
  type HttpParameter,
  type ResolvedBindings,
  type ValidatedBindings,
} from '../types/artifact.js';
import type { GraphInput, GraphSignature, InputMode, InputType } from '../types/resolvers.js';
import { err, ok, ERROR_CODES, type Result, type BindingsError } from '../types/result.js';
import { COMMAND_RESULT_SHAPE_NAME } from '../openapi/command-result.js';

const REQUIRED_BY_MODE: Record<InputMode, readonly boolean[]> = {
  required: [true],
  defaulted: [false],
  predicate_optional: [false],
  nullable: [true, false],
  root: [],
};

function checkGraphShape(
  id: string,
  kind: 'query' | 'command',
  signature: GraphSignature,
  errors: BindingsError[],
): boolean {
  const basePath = `bindings.${id}.graph`;
  let fatal = false;

  for (const [inputName, input] of Object.entries(signature.inputs)) {
    if (input.mode === 'root') {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.BINDINGS_GRAPH_HAS_ROOT_INPUT,
        message: `Graph "${signature.id}" has root input "${inputName}" and cannot be bound as HTTP endpoint`,
        path: basePath,
      });
      fatal = true;
    }
  }

  const role = signature.role ?? 'query';

  if (kind === 'command' && role !== 'command') {
    errors.push({
      layer: 'consistency',
      code: ERROR_CODES.BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH,
      message: `Binding "${id}" has kind="command" but graph "${signature.id}" has role="${role}"`,
      path: basePath,
    });
    fatal = true;
  }
  if (kind === 'query' && role === 'command') {
    errors.push({
      layer: 'consistency',
      code: ERROR_CODES.BINDINGS_QUERY_ON_COMMAND_GRAPH,
      message: `Binding "${id}" has kind="query" (default) but graph "${signature.id}" has role="command"`,
      path: basePath,
    });
    fatal = true;
  }

  if (kind === 'command') {
    const out = signature.output.type;
    const isCommandResultRow = out.kind === 'row' && out.shape === COMMAND_RESULT_SHAPE_NAME;
    if (!isCommandResultRow) {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.BINDINGS_UNSUPPORTED_OUTPUT_TYPE,
        message: `Command graph "${signature.id}" must output row<${COMMAND_RESULT_SHAPE_NAME}>, got ${out.kind === 'scalar' ? 'scalar' : `${out.kind}<${out.shape}>`}`,
        path: basePath,
      });
      fatal = true;
    }
  } else {
    if (signature.output.type.kind !== 'rowset') {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.BINDINGS_UNSUPPORTED_OUTPUT_TYPE,
        message: `Graph "${signature.id}" output kind "${signature.output.type.kind}" is not bindable — must be rowset`,
        path: basePath,
      });
      fatal = true;
    }
  }

  return !fatal;
}

function checkTypeLocation(input: InputType, location: HttpParameter['in']): boolean {
  switch (input.kind) {
    case 'scalar':
      return true; // valid everywhere
    case 'list':
      return location !== 'path';
    case 'row':
    case 'rowset':
      return false; // forbidden anywhere (root would have been caught earlier)
  }
}

function checkParameters(
  id: string,
  entry: BindingEntry,
  signature: GraphSignature,
  errors: BindingsError[],
): void {
  const paramPath = (i: number) => `bindings.${id}.http.parameters[${i}]`;

  entry.http.parameters.forEach((p, i) => {
    const input = signature.inputs[p.bindTo];
    if (input === undefined) return; // already caught by reference layer

    const allowed = REQUIRED_BY_MODE[input.mode];
    if (!allowed.includes(p.required)) {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.BINDINGS_REQUIRED_MISMATCH,
        message:
          `Parameter "${p.name}" in binding "${id}" has required=${p.required}, ` +
          `but input "${p.bindTo}" has mode=${input.mode} (allowed required: [${allowed.join(', ')}])`,
        path: `${paramPath(i)}.required`,
      });
    }

    if (!checkTypeLocation(input.type, p.in)) {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.BINDINGS_TYPE_LOCATION_INVALID,
        message: `Parameter "${p.name}" binds input of kind "${input.type.kind}" to location "${p.in}", which is not allowed`,
        path: `${paramPath(i)}.in`,
      });
    }
  });
}

function checkUnbound(
  id: string,
  entry: BindingEntry,
  signature: GraphSignature,
  errors: BindingsError[],
): void {
  const basePath = `bindings.${id}.http.parameters`;
  const boundTargets = new Set(entry.http.parameters.map((p) => p.bindTo));
  const inputFromTargets = entry.inputFrom ? new Set(Object.keys(entry.inputFrom)) : new Set<string>();

  for (const [inputName, input] of Object.entries(signature.inputs)) {
    if (input.mode === 'root') continue;
    if (input.mode !== 'required' && input.mode !== 'nullable') continue;
    if (!boundTargets.has(inputName) && !inputFromTargets.has(inputName)) {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.BINDINGS_UNBOUND_INPUT,
        message:
          `Input "${inputName}" of graph "${signature.id}" has mode=${input.mode} ` +
          `and must be bound by binding "${id}"`,
        path: basePath,
      });
    }
  }
}

export type ConsistencyOptions = {
  declaredModules?: ReadonlySet<string>;
};

export function validateConsistency(
  resolved: ResolvedBindings,
  opts: ConsistencyOptions = {},
): Result<ValidatedBindings> {
  const errors: BindingsError[] = [];
  const declaredModules = opts.declaredModules ?? new Set<string>();

  for (const [id, binding] of Object.entries(resolved.resolved)) {
    const kind = binding.entry.kind ?? 'query';
    const shapeOk = checkGraphShape(id, kind, binding.signature, errors);
    if (!shapeOk) continue; // don't run parameter checks against unbindable graph

    checkParameters(id, binding.entry, binding.signature, errors);
    checkUnbound(id, binding.entry, binding.signature, errors);

    const pre = binding.entry.pre ?? [];
    for (let idx = 0; idx < pre.length; idx++) {
      const step = pre[idx]!;
      if (step.kind === 'module-rpc' && !declaredModules.has(step.module)) {
        errors.push({
          layer: 'consistency',
          code: ERROR_CODES.BINDINGS_CONSISTENCY_PRE_MODULE_NOT_DECLARED,
          message: `binding "${id}" pre[${idx}] references module "${step.module}" which is not declared in manifest.modules`,
          path: `bindings.${id}.pre[${idx}].module`,
          hint: 'Add the module to manifest.modules[] with grpc.address and protoPath.',
        });
      }

      const name = bindAsName(step.bindAs);
      const pick = bindAsPick(step.bindAs);
      const target = binding.signature.inputs[name];
      if (
        step.kind === 'module-rpc'
        && target !== undefined
        && target.type.kind === 'scalar'
        && pick === null
      ) {
        errors.push({
          layer: 'consistency',
          code: ERROR_CODES.BINDINGS_CONSISTENCY_PRE_SCALAR_REQUIRES_PICK,
          message: `binding "${id}": pre-step binds to scalar "${name}" without pick`,
          path: `bindings.${id}.pre[${idx}].bindAs`,
          hint: `Use bindAs: { name: "${name}", pick: "<field>" } to select a scalar value.`,
        });
      }
    }

    if (binding.entry.inputFrom !== undefined) {
      const graphInputNames = new Set(Object.keys(binding.signature.inputs));
      for (const inputName of Object.keys(binding.entry.inputFrom)) {
        if (!graphInputNames.has(inputName)) {
          errors.push({
            layer: 'consistency',
            code: ERROR_CODES.BINDINGS_CONSISTENCY_INPUT_FROM_UNKNOWN_INPUT,
            message: `binding "${id}": inputFrom key "${inputName}" does not match any graph input`,
            path: `bindings.${id}.inputFrom.${inputName}`,
            hint: `Known graph inputs: ${[...graphInputNames].sort().join(', ')}`,
          });
        }
      }
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(resolved as unknown as ValidatedBindings);
}

// Re-exports used in tests/doc only; keep within this file's surface.
export type { GraphInput };
