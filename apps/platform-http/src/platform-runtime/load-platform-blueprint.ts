import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint, type ComposedBlueprint, type Result } from '@rntme/blueprint';

const here = dirname(fileURLToPath(import.meta.url));

export async function loadPlatformBlueprint(root = resolve(here, '../../../../apps/platform/blueprint')): Promise<Result<ComposedBlueprint>> {
  return loadComposedBlueprint(root);
}
