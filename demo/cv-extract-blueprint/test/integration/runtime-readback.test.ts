import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'bun:test';
import { loadComposedBlueprint } from '../../../../packages/artifacts/blueprint/src/index.js';
import { toDeployCoreInput } from '../../../../packages/platform/deploy-bundle-input/src/index.js';
import {
  loadService,
  startService,
  type ExternalAdapterClient,
  type RunningService,
} from '../../../../packages/runtime/runtime/src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const projectDir = join(here, '..', '..');

describe('cv-extract runtime readback', () => {
  it('projects Resume.complete and reads the completed resume by id', async () => {
    const artifactDir = await buildAppArtifactDir();
    let running: RunningService | null = null;

    try {
      const loaded = loadService(artifactDir);
      expect(loaded.ok, loaded.ok ? '' : JSON.stringify(loaded.errors, null, 2)).toBe(true);
      if (!loaded.ok) return;

      running = await startService(loaded.value, {
        externalAdapterClient: fakeAdapterClient(),
      });
      const baseUrl = `http://127.0.0.1:${running.httpPort}/api`;

      const created = await postJson(`${baseUrl}/resumes`, {
        resumeId: 'resume-local-1',
        filename: 'sample-resume.pdf',
        mediaType: 'application/pdf',
        fileId: 'file-local-1',
        objectKey: 'resumes/file-local-1.pdf',
      });
      expect(created.resumeId).toBe('resume-local-1');

      const resume = await pollResume(`${baseUrl}/resumes/resume-local-1`);
      expect(resume).toMatchObject({
        id: 'resume-local-1',
        status: 'complete',
        filename: 'sample-resume.pdf',
        mediaType: 'application/pdf',
        fileId: 'file-local-1',
        objectKey: 'resumes/file-local-1.pdf',
        downloadUrl: 'https://files.local/download',
        extractedJson: '{"full_name":"Anna Example"}',
      });
    } finally {
      await running?.stop();
      await rm(artifactDir, { recursive: true, force: true });
    }
  });
});

async function buildAppArtifactDir(): Promise<string> {
  const composed = await loadComposedBlueprint(projectDir);
  expect(composed.ok, composed.ok ? '' : JSON.stringify(composed.errors, null, 2)).toBe(true);
  if (!composed.ok) throw new Error('cv-extract composition failed');

  const input = await toDeployCoreInput(composed.value, projectDir);
  const files = input.services.app?.runtimeFiles;
  if (files === undefined) throw new Error('app runtime files missing');

  const artifactDir = await mkdtemp(join(tmpdir(), 'cv-extract-runtime-'));
  for (const [relativePath, contents] of Object.entries(files)) {
    const outputPath = join(artifactDir, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, contents);
  }
  return artifactDir;
}

function fakeAdapterClient(): ExternalAdapterClient {
  return {
    async call(module, rpc) {
      if (module === 'storage' && rpc === 'GetDownloadUrl') {
        return {
          ok: true,
          value: {
            presigned: {
              url: 'https://files.local/download',
              headers: {},
              expires_at: { seconds: 0, nanos: 0 },
            },
          },
        };
      }

      if (module === 'openrouter' && rpc === 'Complete') {
        return {
          ok: true,
          value: {
            content: [{ text: { text: '{"full_name":"Anna Example"}' } }],
          },
        };
      }

      return {
        ok: false,
        errors: [
          {
            code: 'EXTERNAL_MODULE_INTERNAL',
            message: `unexpected module call ${module}.${rpc}`,
            httpStatus: 500,
          },
        ],
      };
    },
  };
}

async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}: ${await res.text()}`);
  return (await res.json()) as Record<string, unknown>;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function pollResume(url: string): Promise<Record<string, unknown>> {
  let last: unknown = null;
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    last = await getJson(url);
    if (
      last !== null &&
      typeof last === 'object' &&
      !Array.isArray(last) &&
      (last as Record<string, unknown>).status === 'complete'
    ) {
      return last as Record<string, unknown>;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`resume did not become readable: ${JSON.stringify(last)}`);
}
