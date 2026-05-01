import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseBindingArtifact,
  validateBindings,
  type ValidatedBindings,
} from '@rntme/bindings';
import type { EventTypeSpec, PdmResolver, ValidatedPdm } from '@rntme/pdm';
import { validateQsm, type ValidatedQsm } from '@rntme/qsm';
import { loadSeed, type ValidatedSeed } from '@rntme/seed';
import type {
  CompositionService,
  ServiceGraphSpec,
  ValidatedServiceMember,
} from '../types/artifact.js';
import {
  ERROR_CODES,
  err,
  ok,
  type BlueprintErrorCode,
  type Result,
} from '../types/result.js';
import { createServiceBindingResolvers } from './binding-resolvers.js';
import { readServiceGraphSpec } from './service-graphs.js';
import { eventTypesForService } from './seed-scope.js';

export function loadServiceMember(input: {
  rootDir: string;
  service: CompositionService;
  pdm: ValidatedPdm;
  pdmResolver: PdmResolver;
  allEventTypes: readonly EventTypeSpec[];
  declaredModules?: ReadonlySet<string>;
}): Result<ValidatedServiceMember> {
  const eventTypes = eventTypesForService(
    input.service.slug,
    input.pdmResolver,
    input.allEventTypes,
  );

  let qsmValidated: ValidatedQsm | null = null;
  if (input.service.qsm !== null) {
    const validated = validateQsm(input.service.qsm, input.pdmResolver);
    if (!validated.ok) {
      return serviceErr(
        ERROR_CODES.BLUEPRINT_SERVICE_QSM_INVALID,
        `service "${input.service.slug}" qsm failed validation`,
        `services/${input.service.slug}/qsm`,
        validated.errors,
      );
    }
    qsmValidated = validated.value;
  }

  let graphSpec: ServiceGraphSpec | null = null;
  if (input.service.artifacts.hasGraphs || input.service.artifacts.hasBindings) {
    const loadedGraphs = readServiceGraphSpec(
      input.rootDir,
      input.service.slug,
    );
    if (!loadedGraphs.ok) return loadedGraphs;
    graphSpec = loadedGraphs.value;
  }

  let bindings: ValidatedBindings | null = null;
  if (input.service.artifacts.hasBindings) {
    if (graphSpec === null) {
      const graphPath = `services/${input.service.slug}/graphs`;
      return serviceErr(
        ERROR_CODES.BLUEPRINT_SERVICE_GRAPHS_INVALID,
        `service "${input.service.slug}" graph spec is required for bindings`,
        graphPath,
      );
    }

    const resolvers = createServiceBindingResolvers({
      serviceSlug: input.service.slug,
      graphSpec,
      pdmResolver: input.pdmResolver,
    });
    if (!resolvers.ok) return resolvers;

    const bindingPath = `services/${input.service.slug}/bindings/bindings.json`;
    const rawBindings = readJson(input.rootDir, bindingPath);
    if (!rawBindings.ok) {
      return serviceErr(
        ERROR_CODES.BLUEPRINT_SERVICE_BINDINGS_INVALID,
        `service "${input.service.slug}" bindings file failed to load`,
        bindingPath,
        rawBindings.errors,
      );
    }

    const parsed = parseBindingArtifact(rawBindings.value);
    if (!parsed.ok) {
      return serviceErr(
        ERROR_CODES.BLUEPRINT_SERVICE_BINDINGS_INVALID,
        `service "${input.service.slug}" bindings failed to parse`,
        bindingPath,
        parsed.errors,
      );
    }

    const consistencyOpts = input.declaredModules === undefined
      ? undefined
      : { declaredModules: input.declaredModules };
    const validated = validateBindings(parsed.value, resolvers.value, consistencyOpts);
    if (!validated.ok) {
      return serviceErr(
        ERROR_CODES.BLUEPRINT_SERVICE_BINDINGS_INVALID,
        `service "${input.service.slug}" bindings failed validation`,
        bindingPath,
        validated.errors,
      );
    }
    bindings = validated.value;
  }

  let seed: ValidatedSeed | null = null;
  const seedPath = `services/${input.service.slug}/seed/seed.json`;
  if (input.service.artifacts.hasSeed || existsSync(join(input.rootDir, seedPath))) {
    const loadedSeed = loadSeed(join(input.rootDir, seedPath), {
      pdm: input.pdmResolver,
      events: eventTypes,
      serviceName: input.service.slug,
    });
    if (!loadedSeed.ok) {
      return serviceErr(
        ERROR_CODES.BLUEPRINT_SERVICE_SEED_INVALID,
        `service "${input.service.slug}" seed failed validation`,
        seedPath,
        loadedSeed.errors,
      );
    }
    seed = loadedSeed.value;
  }

  return ok({
    ...input.service,
    graphSpec,
    qsmValidated,
    bindings,
    seed,
    compiledUi: null,
    eventTypes,
  });
}

function readJson(rootDir: string, relPath: string): Result<unknown> {
  try {
    return ok(JSON.parse(readFileSync(join(rootDir, relPath), 'utf8')));
  } catch (error) {
    return err([
      {
        layer: 'service',
        code: ERROR_CODES.BLUEPRINT_SERVICE_BINDINGS_INVALID,
        message: error instanceof Error ? error.message : String(error),
        path: relPath,
      },
    ]);
  }
}

function serviceErr<T>(
  code: BlueprintErrorCode,
  message: string,
  path: string,
  cause?: readonly unknown[],
): Result<T> {
  return err([
    {
      layer: 'service',
      code,
      message,
      path,
      ...(cause === undefined ? {} : { cause: [...cause] }),
    },
  ]);
}
