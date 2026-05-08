import { err, type Result } from './types/result.js';
import type { CompiledArtifact } from './types/compiled.js';
import { resolve } from './resolve/resolve.js';
import { expand } from './expand/expand.js';
import { validate, type ValidateResolvers } from './validate/index.js';
import { emit } from './emit/emit.js';
import type { HttpEntry } from './emit/http-map.js';

export type CompileOptions = {
  sourceDir: string;
  httpMap: Record<string, HttpEntry>;
  resolvers: ValidateResolvers;
};

export function compile(opts: CompileOptions): Result<CompiledArtifact> {
  const resolved = resolve(opts.sourceDir);
  if (!resolved.ok) return resolved;

  const expanded = expand(resolved.value);
  if (!expanded.ok) return expanded;

  const valid = validate(expanded.value, opts.resolvers);
  if (!valid.ok) return err(valid.errors);

  return emit(expanded.value, opts.httpMap, {
    resolveCategoryToModule: opts.resolvers.resolveCategoryToModule,
  });
}
