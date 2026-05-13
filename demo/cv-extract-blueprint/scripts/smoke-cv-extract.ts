#!/usr/bin/env bun
/**
 * cv-extract end-to-end smoke flow against a deployed app.
 *
 * Exercises the public API surface created by the demo blueprint:
 *
 *   POST /api/files/prepare-upload       -> { uploadUrl, fileId, objectKey, resumeId }
 *   PUT  <uploadUrl>                     -> 200 (S3-style PUT)
 *   POST /api/files/commit-upload        -> { ... }
 *   POST /api/resumes                    -> { resumeId }
 *   GET  /api/resumes/{id}               -> polled until status === "complete"
 *
 * Run directly (after build/deploy):
 *
 *   RNTME_CV_BASE_URL=https://app.example.com bun run scripts/smoke-cv-extract.ts
 *
 * Or import { runSmoke } from another test/script.
 */

export type SmokeResult = {
  resumeId: string;
  resume: {
    extractedJson: string;
    downloadUrl: string;
    fileId: string;
    [k: string]: unknown;
  };
};

export type SmokeOptions = {
  baseUrl: string;
  // Optional override for the sample PDF bytes (defaults to a minimal valid
  // 1-page blank PDF).
  samplePdfBytes?: Uint8Array;
  filename?: string;
  // Max time to poll the resume row before failing.
  pollTimeoutMs?: number;
  pollIntervalMs?: number;
};

/**
 * A minimal valid PDF document (~750 bytes) representing a single blank A4
 * page. Inlined so the smoke flow has no filesystem dependency.
 */
function makeMinimalPdfBytes(): Uint8Array {
  const lines = [
    '%PDF-1.4',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    'endobj',
    '3 0 obj',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    'endobj',
    '4 0 obj',
    '<< /Length 44 >>',
    'stream',
    'BT /F1 24 Tf 100 700 Td (Sample Resume) Tj ET',
    'endstream',
    'endobj',
    '5 0 obj',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    'endobj',
    'xref',
    '0 6',
    '0000000000 65535 f ',
    '0000000010 00000 n ',
    '0000000060 00000 n ',
    '0000000110 00000 n ',
    '0000000220 00000 n ',
    '0000000310 00000 n ',
    'trailer',
    '<< /Size 6 /Root 1 0 R >>',
    'startxref',
    '370',
    '%%EOF',
    '',
  ];
  return new TextEncoder().encode(lines.join('\n'));
}

async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${url} -> ${res.status}: ${text}`);
  }
  const parsed = (await res.json()) as Record<string, unknown>;
  return parsed;
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${url} -> ${res.status}: ${text}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

async function putFile(url: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: bytes as BodyInit,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT ${url} -> ${res.status}: ${text}`);
  }
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

async function pollUntilComplete(
  url: string,
  timeoutMs: number,
  intervalMs: number,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = '';
  while (Date.now() < deadline) {
    const body = await getJson(url);
    const resume = (body.resume ?? body) as Record<string, unknown>;
    lastStatus = asString(resume.status);
    if (lastStatus === 'complete') return resume;
    if (lastStatus === 'failed' || lastStatus === 'errored') {
      throw new Error(`resume ${url} ended in status ${lastStatus}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`resume ${url} did not complete in ${timeoutMs}ms (last status: ${lastStatus})`);
}

export async function runSmoke(opts: SmokeOptions): Promise<SmokeResult> {
  const baseUrl = opts.baseUrl.replace(/\/+$/, '');
  const filename = opts.filename ?? 'sample-resume.pdf';
  const mediaType = 'application/pdf';
  const samplePdfBytes = opts.samplePdfBytes ?? makeMinimalPdfBytes();
  const pollTimeoutMs = opts.pollTimeoutMs ?? 5 * 60_000;
  const pollIntervalMs = opts.pollIntervalMs ?? 3_000;

  // 1. Prepare upload.
  const prepare = (await postJson(`${baseUrl}/api/files/prepare-upload`, {
    filename,
    mediaType,
    declaredSize: samplePdfBytes.byteLength,
  })) as {
    uploadUrl: string;
    fileId: string;
    objectKey: string;
    resumeId: string;
  };

  // 2. PUT the bytes at the presigned URL.
  await putFile(prepare.uploadUrl, samplePdfBytes, mediaType);

  // 3. Commit the upload.
  await postJson(`${baseUrl}/api/files/commit-upload`, { fileId: prepare.fileId });

  // 4. Create the resume row.
  const created = (await postJson(`${baseUrl}/api/resumes`, {
    resumeId: prepare.resumeId,
    filename,
    mediaType,
    fileId: prepare.fileId,
    objectKey: prepare.objectKey,
  })) as { resumeId: string };
  const resumeId = asString(created.resumeId) || prepare.resumeId;

  // 5. Poll until extraction completes.
  const resume = await pollUntilComplete(
    `${baseUrl}/api/resumes/${encodeURIComponent(resumeId)}`,
    pollTimeoutMs,
    pollIntervalMs,
  );

  return {
    resumeId,
    resume: {
      extractedJson: asString(resume.extractedJson),
      downloadUrl: asString(resume.downloadUrl),
      fileId: asString(resume.fileId),
      ...resume,
    },
  };
}

// CLI entrypoint.
async function main(): Promise<void> {
  const baseUrl = process.env.RNTME_CV_BASE_URL;
  if (!baseUrl || baseUrl.length === 0) {
    console.error('error: RNTME_CV_BASE_URL is required');
    process.exit(1);
  }
  const result = await runSmoke({ baseUrl });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

const isDirectRun =
  typeof Bun !== 'undefined' && import.meta.path === Bun.main;
if (isDirectRun) {
  await main();
}
