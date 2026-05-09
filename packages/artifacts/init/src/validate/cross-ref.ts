import { parseSeed, validateSeed } from '@rntme/seed';
import type { StructurallyValidInitArtifact, ValidatedInitArtifact } from '../types/artifact.js';
import type { InitCrossRefContext } from '../types/context.js';
import { ERROR_CODES, err, ok, type InitError, type Result } from '../types/result.js';

export function validateInitCrossRef(
  artifact: StructurallyValidInitArtifact,
  ctx: InitCrossRefContext,
): Result<ValidatedInitArtifact> {
  const errors: InitError[] = [];
  const services = new Set(ctx.services);

  if (!ctx.fileExists(artifact.process.definition)) {
    errors.push({
      layer: 'cross-ref',
      code: ERROR_CODES.INIT_XREF_PROCESS_DEFINITION_MISSING,
      message: `init process definition "${artifact.process.definition}" does not exist under init/`,
      path: 'process.definition',
    });
  }

  for (const [idx, step] of artifact.steps.entries()) {
    if (!services.has(step.targetService)) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.INIT_XREF_TARGET_SERVICE_UNKNOWN,
        message: `init step "${step.id}" references unknown service "${step.targetService}"`,
        path: `steps.${idx}.targetService`,
      });
      continue;
    }

    if (!ctx.fileExists(step.input.path)) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.INIT_XREF_STEP_INPUT_MISSING,
        message: `init step "${step.id}" input "${step.input.path}" does not exist under init/`,
        path: `steps.${idx}.input.path`,
      });
      continue;
    }

    if (step.provider === 'seed-events') {
      const rawSeed = ctx.readJson(step.input.path);
      const parsedSeed = parseSeed(rawSeed);
      if (!parsedSeed.ok) {
        errors.push({
          layer: 'cross-ref',
          code: ERROR_CODES.INIT_XREF_SEED_INVALID,
          message: `init step "${step.id}" seed input failed to parse`,
          path: `steps.${idx}.input.path`,
          cause: parsedSeed.errors,
        });
        continue;
      }

      const serviceEvents = ctx.eventsByService[step.targetService] ?? [];
      const validatedSeed = validateSeed(parsedSeed.value, {
        pdm: ctx.pdm,
        events: serviceEvents,
        serviceName: step.targetService,
      });
      if (!validatedSeed.ok) {
        errors.push({
          layer: 'cross-ref',
          code: ERROR_CODES.INIT_XREF_SEED_INVALID,
          message: `init step "${step.id}" seed input failed validation`,
          path: `steps.${idx}.input.path`,
          cause: validatedSeed.errors,
        });
      }
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(artifact as ValidatedInitArtifact);
}
