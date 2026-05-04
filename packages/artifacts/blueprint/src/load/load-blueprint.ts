import { existsSync, readFileSync } from 'node:fs';
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

export function loadBlueprint(dir: string): Result<LoadedBlueprint> {
  try {
    const projectPath = join(dir, 'project.json');
    const pdmDir = join(dir, 'pdm');

    if (!existsSync(projectPath)) {
      return err([
        {
          layer: 'load',
          code: ERROR_CODES.BLUEPRINT_IO_ERROR,
          message: 'missing required file: project.json',
          path: 'project.json',
        },
      ]);
    }
    if (!existsSync(pdmDir)) {
      return err([
        {
          layer: 'load',
          code: ERROR_CODES.BLUEPRINT_IO_ERROR,
          message: 'missing required directory: pdm',
          path: 'pdm',
        },
      ]);
    }

    const parsedProject = parseProjectBlueprint(
      JSON.parse(readFileSync(projectPath, 'utf8')),
    );
    if (!parsedProject.ok) return parsedProject;

    const rawPdm = loadPdmDir(pdmDir);
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

    const serviceDirs = listServiceDirs(dir);
    const services: Record<string, ServiceDescriptor & { qsm: QsmArtifact | null }> =
      {};

    for (const slug of serviceDirs) {
      const servicePath = serviceDirPath(dir, slug);
      if (!existsSync(join(servicePath, 'service.json'))) continue;

      const parsedDescriptor = ServiceDescriptorSchema.safeParse(
        readJsonFile(servicePath, 'service.json'),
      );
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
      if (parsedDescriptor.success) {
        const qsmDir = join(servicePath, 'qsm');
        let qsm: QsmArtifact | null = null;
        if (existsSync(qsmDir)) {
          const loadedQsm = loadQsmDir(qsmDir);
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

        services[slug] = {
          slug,
          kind: parsedDescriptor.data.kind,
          qsm,
        };
      }
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
