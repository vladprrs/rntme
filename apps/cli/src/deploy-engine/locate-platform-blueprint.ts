import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { cliError, type CliError } from '../errors/codes.js';

export function locatePlatformBlueprint(): Result<string, CliError> {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/deploy-engine/locate-platform-blueprint.js → ../platform-blueprint
  // src/deploy-engine/locate-platform-blueprint.ts (unbuilt) → ../../../../apps/platform/blueprint
  const bundled = resolve(here, '..', 'platform-blueprint');
  if (existsSync(join(bundled, 'project.json'))) return ok(bundled);
  const fallback = resolve(here, '..', '..', '..', '..', 'apps', 'platform', 'blueprint');
  if (existsSync(join(fallback, 'project.json'))) return ok(fallback);
  return err(
    cliError(
      'CLI_DEPLOY_PLATFORM_BLUEPRINT_NOT_BUNDLED',
      `bundled platform blueprint not found; expected ${bundled}/project.json`,
    ),
  );
}
