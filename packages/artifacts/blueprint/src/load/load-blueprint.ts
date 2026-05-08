import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { loadPdmDir, validatePdm } from '@rntme/pdm';
import { loadQsmDir, type QsmArtifact } from '@rntme/qsm';
import { parseProjectBlueprint } from '../parse/parse.js';
import { ServiceDescriptorSchema } from '../parse/schema.js';
import { validateBlueprintStructural } from '../validate/structural.js';
import {
  err,
  ok,
  ERROR_CODES,
  type Result,
} from '../types/result.js';
import type {
  LoadedBlueprint,
  ServiceDescriptor,
} from '../types/artifact.js';
import {
  listServiceDirs,
  readJsonFile,
  serviceDirPath,
} from './read-dir.js';

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

type LoadedService = ServiceDescriptor & { qsm: QsmArtifact | null };

async function loadServiceDescriptor(
  rootDir: string,
  slug: string,
): Promise<Result<LoadedService | null>> {
  const servicePath = serviceDirPath(rootDir, slug);
  const serviceJsonPath = join(servicePath, 'service.json');
  if (!(await pathExists(serviceJsonPath))) return ok(null);

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(serviceJsonPath, 'utf8'));
  } catch (error) {
    return err([
      {
        layer: 'load',
        code: ERROR_CODES.BLUEPRINT_IO_ERROR,
        message: error instanceof Error ? error.message : String(error),
        path: `services/${slug}/service.json`,
      },
    ]);
  }

  const parsedDescriptor = ServiceDescriptorSchema.safeParse(raw);
  if (!parsedDescriptor.success) {
    return err([
      {
        layer: 'load',
        code: ERROR_CODES.BLUEPRINT_SERVICE_JSON_MALFORMED,
        message: `service "${slug}" service.json failed validation`,
        path: `services/${slug}/service.json`,
        cause: parsedDescriptor.error.issues,
      },
    ]);
  }

  const qsmDir = join(servicePath, 'qsm');
  let qsm: QsmArtifact | null = null;
  if (await pathExists(qsmDir)) {
    const loadedQsm = await loadQsmDir(qsmDir);
    if (!loadedQsm.ok) {
      return err([
        {
          layer: 'load',
          code: ERROR_CODES.BLUEPRINT_IO_ERROR,
          message: `service "${slug}" qsm directory failed to load`,
          path: `services/${slug}/qsm`,
          cause: loadedQsm.errors,
        },
      ]);
    }
    qsm = loadedQsm.value;
  }

  return ok({
    slug,
    kind: parsedDescriptor.data.kind,
    qsm,
  });
}

export async function loadBlueprint(dir: string): Promise<Result<LoadedBlueprint>> {
  try {
    const projectPath = join(dir, 'project.json');
    const pdmDir = join(dir, 'pdm');

    const [projectExists, pdmDirExists] = await Promise.all([
      pathExists(projectPath),
      pathExists(pdmDir),
    ]);

    if (!projectExists) {
      return err([
        {
          layer: 'load',
          code: ERROR_CODES.BLUEPRINT_IO_ERROR,
          message: 'missing required file: project.json',
          path: 'project.json',
        },
      ]);
    }
    if (!pdmDirExists) {
      return err([
        {
          layer: 'load',
          code: ERROR_CODES.BLUEPRINT_IO_ERROR,
          message: 'missing required directory: pdm',
          path: 'pdm',
        },
      ]);
    }

    // Read project.json, load pdm dir, and discover service dirs in parallel.
    const [projectRaw, rawPdm, serviceDirs] = await Promise.all([
      readJsonFile(dir, 'project.json'),
      loadPdmDir(pdmDir),
      listServiceDirs(dir),
    ]);

    const parsedProject = parseProjectBlueprint(projectRaw);
    if (!parsedProject.ok) return parsedProject;

    if (!rawPdm.ok) {
      return err([
        {
          layer: 'load',
          code: ERROR_CODES.BLUEPRINT_IO_ERROR,
          message: 'project pdm directory failed to load',
          path: 'pdm',
          cause: rawPdm.errors,
        },
      ]);
    }

    const validatedPdm = validatePdm(rawPdm.value);
    if (!validatedPdm.ok) {
      return err([
        {
          layer: 'load',
          code: ERROR_CODES.BLUEPRINT_IO_ERROR,
          message: 'project pdm failed validation',
          path: 'pdm',
          cause: validatedPdm.errors,
        },
      ]);
    }

    // Load each service descriptor in parallel.
    const serviceResults = await Promise.all(
      serviceDirs.map((slug) => loadServiceDescriptor(dir, slug)),
    );

    const services: Record<string, LoadedService> = {};
    for (const result of serviceResults) {
      if (!result.ok) return result;
      if (result.value === null) continue;
      services[result.value.slug] = result.value;
    }

    const structural = validateBlueprintStructural({
      project: parsedProject.value,
      serviceDirs,
      services,
    });
    if (!structural.ok) {
      return err(structural.errors);
    }

    return ok({
      project: parsedProject.value,
      pdm: validatedPdm.value,
      services,
    });
  } catch (error) {
    return err([
      {
        layer: 'load',
        code: ERROR_CODES.BLUEPRINT_IO_ERROR,
        message: error instanceof Error ? error.message : String(error),
        path: dir,
      },
    ]);
  }
}
