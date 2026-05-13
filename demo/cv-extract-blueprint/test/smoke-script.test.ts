import { afterEach, describe, expect, it } from 'bun:test';
import { runSmoke } from '../scripts/smoke-cv-extract.js';

const originalFetch = globalThis.fetch;

describe('cv-extract smoke script', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends storage prepare-upload contentType and resume mediaType fields', async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? 'GET'} ${url}`);

      if (url === 'https://cv.example/api/files/prepare-upload') {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        expect(body).toMatchObject({
          filename: 'sample-resume.pdf',
          contentType: 'application/pdf',
          declaredSize: 4,
        });
        expect(body).not.toHaveProperty('mediaType');
        return jsonResponse({
          uploadUrl: 'https://files.example/upload',
          fileId: 'file_123',
          objectKey: 'resumes/file_123.pdf',
          resumeId: 'resume_123',
        });
      }

      if (url === 'https://files.example/upload') {
        expect(init?.method).toBe('PUT');
        expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/pdf');
        return new Response('', { status: 200 });
      }

      if (url === 'https://cv.example/api/files/commit-upload') {
        expect(JSON.parse(String(init?.body ?? '{}'))).toEqual({ fileId: 'file_123' });
        return jsonResponse({ ok: true });
      }

      if (url === 'https://cv.example/api/resumes') {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        expect(body).toMatchObject({
          resumeId: 'resume_123',
          filename: 'sample-resume.pdf',
          mediaType: 'application/pdf',
          fileId: 'file_123',
          objectKey: 'resumes/file_123.pdf',
        });
        return jsonResponse({ resumeId: 'resume_123' });
      }

      if (url === 'https://cv.example/api/resumes/resume_123') {
        return jsonResponse({
          resume: {
            status: 'complete',
            extractedJson: '{"full_name":"Example Candidate"}',
            downloadUrl: 'https://files.example/download',
            fileId: 'file_123',
          },
        });
      }

      return new Response(`unexpected URL ${url}`, { status: 500 });
    }) as typeof fetch;

    const result = await runSmoke({
      baseUrl: 'https://cv.example',
      samplePdfBytes: new Uint8Array([1, 2, 3, 4]),
      pollTimeoutMs: 50,
      pollIntervalMs: 1,
    });

    expect(result.resumeId).toBe('resume_123');
    expect(result.resume.extractedJson).toContain('Example Candidate');
    expect(calls).toEqual([
      'POST https://cv.example/api/files/prepare-upload',
      'PUT https://files.example/upload',
      'POST https://cv.example/api/files/commit-upload',
      'POST https://cv.example/api/resumes',
      'GET https://cv.example/api/resumes/resume_123',
    ]);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
