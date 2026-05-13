import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'bun:test';
import { loadBlueprint } from '@rntme/blueprint';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as T;
}

describe('cv-extract demo: composition', () => {
  it('project.json declares app + openrouter + storage-s3 services', () => {
    const project = readJson<{ services: string[] }>('project.json');
    expect(project.services).toEqual(['app', 'openrouter', 'storage-s3']);
  });

  it('project.json modules wire openrouter, storage, and marketing-site modules', () => {
    const project = readJson<{
      modules: Record<string, { package: string; publicConfig?: Record<string, unknown> }>;
    }>('project.json');
    expect(project.modules.openrouter?.package).toBe('@rntme/ai-llm-openrouter');
    expect(project.modules.storage?.package).toBe('@rntme/storage-s3');
    expect(project.modules['marketing-site']?.package).toBe('@rntme/marketing-site-static');
    expect(
      (project.modules['marketing-site']?.publicConfig as { source: { kind: string } }).source.kind,
    ).toBe('project-folder');
  });

  it('MARKETING_DOMAIN var sources from target.modules.marketing-site.primaryDomain', () => {
    const project = readJson<{
      vars: Record<string, { from: string; required?: boolean }>;
    }>('project.json');
    expect(project.vars.MARKETING_DOMAIN?.from).toBe('target.modules.marketing-site.primaryDomain');
    expect(project.vars.MARKETING_DOMAIN?.required).toBe(true);
  });

  it('openrouter + storage-s3 services declare kind=integration-module with module aliases', () => {
    const openrouter = readJson<{ kind: string; module: string }>(
      'services/openrouter/service.json',
    );
    const storage = readJson<{ kind: string; module: string }>(
      'services/storage-s3/service.json',
    );
    expect(openrouter.kind).toBe('integration-module');
    expect(openrouter.module).toBe('openrouter');
    expect(storage.kind).toBe('integration-module');
    expect(storage.module).toBe('storage');
  });

  it('services/app/storage.json declares the resume-file route owned by Resume', () => {
    const storage = readJson<{
      version: string;
      routes: Record<string, {
        owner: { aggregate: string; association: string };
        maxSize: string;
        allowedTypes: string[];
        maxCount: number | null;
        auth: { requireRole: string[] | null };
        lifecycle: { expirePending: string; retainCommitted: string | null };
      }>;
    }>('services/app/storage.json');
    expect(storage.version).toBe('1.0');
    const route = storage.routes['resume-file'];
    expect(route).toBeDefined();
    expect(route?.owner).toEqual({ aggregate: 'Resume', association: 'file' });
    expect(route?.maxSize).toBe('20MB');
    expect(route?.allowedTypes).toEqual(['application/pdf']);
    expect(route?.maxCount).toBe(1);
    expect(route?.auth.requireRole).toBeNull();
    expect(route?.lifecycle.expirePending).toBe('15m');
    expect(route?.lifecycle.retainCommitted).toBe('30d');
  });

  it('Resume PDM has fileId/objectKey/downloadUrl/extractedJson and the complete transition affects them', () => {
    const resume = readJson<{
      fields: Record<string, { type: string; nullable: boolean }>;
      stateMachine: {
        stateField: string;
        initial: null | string;
        states: string[];
        transitions: Record<string, { from: null | string; to: string; affects: string[] }>;
      };
    }>('pdm/entities/Resume.json');
    expect(Object.keys(resume.fields)).toEqual(
      expect.arrayContaining(['fileId', 'objectKey', 'downloadUrl', 'extractedJson']),
    );
    expect(resume.stateMachine.stateField).toBe('status');
    expect(resume.stateMachine.initial).toBeNull();
    expect(resume.stateMachine.states).toEqual(['complete']);
    expect(resume.stateMachine.transitions.complete?.from).toBeNull();
    expect(resume.stateMachine.transitions.complete?.to).toBe('complete');
    expect(resume.stateMachine.transitions.complete?.affects).toEqual(
      expect.arrayContaining([
        'filename',
        'mediaType',
        'fileId',
        'objectKey',
        'downloadUrl',
        'extractedJson',
      ]),
    );
  });

  it('ResumeView projection exposes fileId, objectKey, downloadUrl', () => {
    const view = readJson<{ exposed: string[] }>('services/app/qsm/projections/ResumeView.json');
    expect(view.exposed).toEqual(
      expect.arrayContaining(['fileId', 'objectKey', 'downloadUrl']),
    );
  });

  it('shapes.json defines PrepareUploadResult and CommitUploadResult with scalar-only fields', () => {
    const shapes = readJson<
      Record<string, { fields: Record<string, { type: string; nullable: boolean }> }>
    >('services/app/graphs/shapes.json');

    const prep = shapes.PrepareUploadResult;
    expect(prep).toBeDefined();
    expect(Object.keys(prep!.fields).sort()).toEqual(
      ['fileId', 'objectKey', 'resumeId', 'uploadUrl'].sort(),
    );
    for (const f of Object.values(prep!.fields)) {
      expect(['string', 'integer', 'boolean', 'datetime']).toContain(f.type);
    }

    const commit = shapes.CommitUploadResult;
    expect(commit).toBeDefined();
    expect(Object.keys(commit!.fields)).toEqual(['fileId']);
    for (const f of Object.values(commit!.fields)) {
      expect(['string', 'integer', 'boolean', 'datetime']).toContain(f.type);
    }
  });

  it('prepareResumeFileUpload graph calls storage.PrepareUpload with proto field names and returns presigned.url', () => {
    const g = readJson<{
      nodes: Array<{
        id: string;
        type: string;
        target?: { module?: string; operation?: string };
        input?: Record<string, unknown>;
        value?: Record<string, unknown>;
      }>;
    }>('services/app/graphs/prepareResumeFileUpload.json');

    const prepared = g.nodes.find((n) => n.id === 'prepared');
    expect(prepared?.type).toBe('call');
    expect(prepared?.target).toEqual({ module: 'storage', operation: 'PrepareUpload' });
    const input = prepared?.input ?? {};
    expect(Object.keys(input).sort()).toEqual(
      ['content_type', 'context', 'declared_size', 'entity_id', 'filename', 'route_id'].sort(),
    );

    const out = g.nodes.find((n) => n.id === 'out');
    const v = out?.value as Record<string, unknown>;
    expect(v.fileId).toEqual({ $ref: 'prepared.result.file_id' });
    expect(v.objectKey).toEqual({ $ref: 'prepared.result.object_key' });
    expect(v.uploadUrl).toEqual({ $ref: 'prepared.result.presigned.url' });
  });

  it('commitResumeFileUpload graph calls storage.CommitUpload with file_id', () => {
    const g = readJson<{
      nodes: Array<{ id: string; type: string; target?: { module?: string; operation?: string }; input?: Record<string, unknown> }>;
    }>('services/app/graphs/commitResumeFileUpload.json');

    const committed = g.nodes.find((n) => n.id === 'committed');
    expect(committed?.type).toBe('call');
    expect(committed?.target).toEqual({ module: 'storage', operation: 'CommitUpload' });
    expect(committed?.input?.file_id).toEqual({ $param: 'fileId' });
  });

  it('extractResume graph calls storage.GetDownloadUrl FIRST and passes the URL to OpenRouter (no base64)', () => {
    const g = readJson<{
      nodes: Array<{
        id: string;
        type: string;
        target?: { module?: string; operation?: string };
        input?: Record<string, unknown>;
      }>;
    }>('services/app/graphs/extractResume.json');

    const downloadIdx = g.nodes.findIndex((n) => n.id === 'download');
    const completionIdx = g.nodes.findIndex((n) => n.id === 'completion');
    expect(downloadIdx).toBeGreaterThanOrEqual(0);
    expect(completionIdx).toBeGreaterThan(downloadIdx);

    const download = g.nodes[downloadIdx]!;
    expect(download.target).toEqual({ module: 'storage', operation: 'GetDownloadUrl' });
    expect(download.input?.file_id).toEqual({ $param: 'fileId' });
    expect(download.input?.ttl_sec).toEqual({ $literal: 900 });

    const completion = g.nodes[completionIdx]!;
    expect(completion.target).toEqual({ module: 'openrouter', operation: 'Complete' });

    // The OpenRouter call must NOT carry base64 file data — the file block uses url=$ref.
    const messages = (completion.input?.messages as { $literal?: unknown })?.$literal as unknown;
    const serialized = JSON.stringify(messages);
    expect(serialized).not.toContain('base64Data');
    expect(serialized).not.toContain('base64_data');
    expect(serialized).toContain('"$ref":"download.result.presigned.url"');
  });

  it('bindings.json registers the four HTTP endpoints with the expected paths and exposures', () => {
    const b = readJson<{
      bindings: Record<
        string,
        { graph: string; exposure: string; http: { method: string; path: string } }
      >;
    }>('services/app/bindings/bindings.json');

    expect(b.bindings.prepareResumeFileUpload?.http).toMatchObject({
      method: 'POST',
      path: '/files/prepare-upload',
    });
    expect(b.bindings.prepareResumeFileUpload?.exposure).toBe('action');

    expect(b.bindings.commitResumeFileUpload?.http).toMatchObject({
      method: 'POST',
      path: '/files/commit-upload',
    });
    expect(b.bindings.commitResumeFileUpload?.exposure).toBe('action');

    expect(b.bindings.extractResume?.http).toMatchObject({ method: 'POST', path: '/resumes' });
    expect(b.bindings.extractResume?.exposure).toBe('action');

    expect(b.bindings.getResume?.http).toMatchObject({ method: 'GET', path: '/resumes/{id}' });
    expect(b.bindings.getResume?.exposure).toBe('read');
  });

  it('loadBlueprint (parse + structural) accepts the blueprint and surfaces moduleKey for storage-s3', async () => {
    // The full `loadComposedBlueprint` path additionally validates each
    // declared module's `module.json` against the contracts-module-v1 schema.
    // The marketing-site-static module manifest carries a non-canonical
    // `capabilities.hostedSurface` field — outside this task's scope — so
    // the deep compose path is exercised by upstream task(s). Here we cover
    // the parse + structural layers that ARE owned by this blueprint.
    const result = await loadBlueprint(ROOT);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.project.services).toEqual(['app', 'openrouter', 'storage-s3']);
    expect(result.value.services['storage-s3']?.kind).toBe('integration-module');
    expect(result.value.services['storage-s3']?.moduleKey).toBe('storage');
    expect(result.value.services['openrouter']?.kind).toBe('integration-module');
    expect(result.value.services['openrouter']?.moduleKey).toBe('openrouter');
  });
});
