import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBindingArtifact } from '../../../src/parse/parse.js';
import { validateBindings } from '../../../src/validate/index.js';
import { generateOpenApi } from '../../../src/openapi/emit.js';
import { resolvers } from './fixtures.js';

const here = dirname(fileURLToPath(import.meta.url));
const artifactJson = readFileSync(join(here, 'artifact.json'), 'utf8');

describe('golden: category-sales', () => {
  it('parses, validates, and emits a stable OpenAPI document', async () => {
    const parsed = parseBindingArtifact(artifactJson);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const validated = validateBindings(parsed.value, resolvers);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const emitted = generateOpenApi(validated.value);
    expect(emitted.ok).toBe(true);
    if (!emitted.ok) return;

    const serialized = JSON.stringify(emitted.value, null, 2) + '\n';
    await expect(serialized).toMatchFileSnapshot(join(here, 'expected.openapi.json'));
  });
});
