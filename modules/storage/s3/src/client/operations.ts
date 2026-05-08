import type { ModuleBootContext } from '@rntme/contracts-client-runtime-v1';

export const STORAGE_MODULE_NAME = '@rntme/storage-s3';

export interface UploadParams {
  routeId: string;
  entityId: string;
  filename: string;
  contentType: string;
  declaredSize: number;
}

export interface PrepareUploadResult {
  fileId: string;
  objectKey: string;
  presigned: {
    url: string;
    headers: Record<string, string>;
    expiresAt: string;
  };
}

export interface ListedFile {
  fileId: string;
  contentType: string;
  sizeBytes: number;
  filename?: string;
}

async function postJson(ctx: ModuleBootContext, path: string, params: Record<string, unknown>): Promise<Response> {
  return ctx.transport.fetch(
    new Request(requestUrl(path), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    }),
  );
}

function requestUrl(path: string): string {
  const origin = globalThis.location?.origin ?? 'http://localhost';
  return new URL(path, origin).toString();
}

async function readJson<T>(res: Response, op: string): Promise<T> {
  if (!res.ok) throw new Error(`${op} ${res.status}`);
  return res.json() as Promise<T>;
}

async function readEmpty(res: Response, op: string): Promise<void> {
  if (!res.ok) throw new Error(`${op} ${res.status}`);
}

export function registerStorageOperations(ctx: ModuleBootContext): void {
  ctx.registerOperation('storage.upload.prepare', async (params) =>
    readJson<PrepareUploadResult>(await postJson(ctx, '/storage/PrepareUpload', params), 'PrepareUpload'),
  );

  ctx.registerOperation('storage.upload.commit', async (params) => {
    await readEmpty(await postJson(ctx, '/storage/CommitUpload', params), 'CommitUpload');
  });

  ctx.registerOperation('storage.list', async (params) =>
    readJson<{ files: ListedFile[] }>(await postJson(ctx, '/storage/ListFiles', params), 'ListFiles'),
  );

  ctx.registerOperation('storage.delete', async (params) => {
    await readEmpty(await postJson(ctx, '/storage/DeleteFile', params), 'DeleteFile');
  });

  ctx.registerOperation('storage.getDownloadUrl', async (params) =>
    readJson<{ url: string; expiresAt: string }>(
      await postJson(ctx, '/storage/GetDownloadUrl', params),
      'GetDownloadUrl',
    ),
  );
}
