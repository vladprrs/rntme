import type { Buffer } from 'node:buffer';
import { readFile, stat } from 'node:fs/promises';
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
import { validateStorageJson } from '../validate/storage/index.js';

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function loadServiceMember(input: {
  rootDir: string;
  service: CompositionService;
  pdm: ValidatedPdm;
  pdmResolver: PdmResolver;
  allEventTypes: readonly EventTypeSpec[];
  declaredModules?: ReadonlySet<string>;
}): Promise<Result<ValidatedServiceMember>> {
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
    const loadedGraphs = await readServiceGraphSpec(
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
    const rawBindings = await readJson(input.rootDir, bindingPath);
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
  const seedAbsPath = join(input.rootDir, seedPath);
  if (input.service.artifacts.hasSeed || (await pathExists(seedAbsPath))) {
    let seedBuffer: Buffer;
    try {
      seedBuffer = await readFile(seedAbsPath);
    } catch (error) {
      return serviceErr(
        ERROR_CODES.BLUEPRINT_IO_ERROR,
        error instanceof Error ? error.message : String(error),
        seedPath,
      );
    }
    const loadedSeed = loadSeed(seedBuffer, {
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

  let storage = null;
  const storagePath = `services/${input.service.slug}/storage.json`;
  const storageAbsPath = join(input.rootDir, storagePath);
  if (input.service.artifacts.hasStorage || (await pathExists(storageAbsPath))) {
    let text: string;
    try {
      text = await readFile(storageAbsPath, 'utf8');
    } catch (error) {
      return serviceErr(
        ERROR_CODES.BLUEPRINT_IO_ERROR,
        error instanceof Error ? error.message : String(error),
        storagePath,
      );
    }

    const validatedStorage = validateStorageJson(text, input.pdm);
    if (!validatedStorage.ok) {
      return serviceErr(
        ERROR_CODES.BLUEPRINT_SERVICE_STORAGE_INVALID,
        `service "${input.service.slug}" storage.json failed validation`,
        storagePath,
        validatedStorage.errors,
      );
    }
    storage = validatedStorage.value;
  }

  return ok({
    ...input.service,
    graphSpec,
    qsmValidated,
    bindings,
    seed,
    storage,
    compiledUi: null,
    eventTypes,
  });
}

async function readJson(rootDir: string, relPath: string): Promise<Result<unknown>> {
  try {
    return ok(JSON.parse(await readFile(join(rootDir, relPath), 'utf8')));
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
