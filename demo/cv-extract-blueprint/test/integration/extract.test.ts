import { describe, expect, it, mock } from 'bun:test';
import { createOpenRouterModule, createIdempotencyStore } from '@rntme/ai-llm-openrouter';

const ORHappyResponse = {
  id: 'gen-mock',
  model: 'openai/gpt-4o',
  choices: [
    {
      message: {
        role: 'assistant',
        content: JSON.stringify({
          full_name: 'Anna Example',
          experience: [
            { company: 'Acme Corp', title: 'Senior Software Engineer', start_date: '2023-01', end_date: 'present' },
            { company: 'Initech', title: 'Software Engineer', start_date: '2020-06', end_date: '2022-12' },
          ],
          education: [{ institution: 'University of Test', degree: 'BSc Computer Science', year: '2020' }],
          skills: ['TypeScript', 'Go', 'distributed systems', 'event sourcing'],
        }),
      },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
};

// Minimal stub of the storage module's StorageModule service-shape: only the
// RPCs the cv-extract graphs invoke (PrepareUpload, CommitUpload,
// GetDownloadUrl). Each stub records the call so the assertions below can
// verify proto field names and absence of base64 payloads.
function createStorageStub() {
  const calls: { op: string; req: Record<string, unknown> }[] = [];
  return {
    calls,
    PrepareUpload: async (req: { route_id: string; entity_id: string; filename: string; content_type: string; declared_size: number }) => {
      calls.push({ op: 'PrepareUpload', req });
      return {
        file_id: 'file-stub-1',
        object_key: `cv-extract-files/${req.entity_id}/sample-resume.pdf`,
        presigned: {
          url: 'https://stub.rustfs.local/cv-extract-files/upload',
          headers: { 'content-type': req.content_type },
          expires_at: { seconds: 0, nanos: 0 },
        },
      };
    },
    CommitUpload: async (req: { file_id: string }) => {
      calls.push({ op: 'CommitUpload', req });
      return { file: { file_id: req.file_id, state: 2 } };
    },
    GetDownloadUrl: async (req: { file_id: string; ttl_sec?: number }) => {
      calls.push({ op: 'GetDownloadUrl', req });
      return {
        presigned: {
          url: `https://stub.rustfs.local/cv-extract-files/${req.file_id}?sig=download`,
          headers: {},
          expires_at: { seconds: 0, nanos: 0 },
        },
      };
    },
  };
}

describe('cv-extract demo: storage + openrouter flow', () => {
  it('storage.GetDownloadUrl receives file_id and returns a download URL', async () => {
    const storage = createStorageStub();
    const result = await storage.GetDownloadUrl({ file_id: 'file-abc', ttl_sec: 900 });
    expect(storage.calls).toEqual([
      { op: 'GetDownloadUrl', req: { file_id: 'file-abc', ttl_sec: 900 } },
    ]);
    expect(result.presigned.url).toContain('file-abc');
  });

  it('openrouter Complete receives a file URL (not base64) when called with the storage-issued download URL', async () => {
    const storage = createStorageStub();
    const downloadResp = await storage.GetDownloadUrl({ file_id: 'file-abc', ttl_sec: 900 });
    const downloadUrl = downloadResp.presigned.url;

    const fetchMock = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => ORHappyResponse,
      text: async () => '',
    }));
    const store = createIdempotencyStore({ mode: 'memory', ttlMs: 24 * 3600_000 });
    const mod = createOpenRouterModule({
      apiKey: 'sk-test',
      baseUrl: 'https://or-mock/api/v1',
      fetch: fetchMock,
      store,
      bus: { emit: async () => {} },
      now: () => Date.parse('2026-05-13T10:00:00Z'),
    });

    const completion = (await mod.Complete!({
      context: { idempotencyKey: 'cv-test-url-1' },
      model: 'openrouter/openai/gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            // File block points at the storage-issued URL, not base64.
            { type: 4, file: { filename: 'sample-resume.pdf', mediaType: 'application/pdf', url: downloadUrl } },
            { type: 1, text: { text: 'Extract the candidate info.' } },
          ],
        },
      ],
      sampling: {
        responseFormat: 'json_schema',
        responseSchema: { type: 'object', properties: { full_name: { type: 'string' } } },
      },
    })) as { content: { text?: { text: string } }[] };

    const json = JSON.parse(completion.content[0]!.text!.text) as { full_name: string };
    expect(json.full_name).toBe('Anna Example');

    // OpenRouter received exactly one HTTP request; inspect its body.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string) as {
      model: string;
      messages: Array<{ content: Array<unknown> }>;
    };
    expect(body.model).toBe('openai/gpt-4o');

    // The wire request must reference a URL — never a base64 payload.
    const serialized = JSON.stringify(body.messages);
    expect(serialized).toContain(downloadUrl);
    expect(serialized).not.toContain('base64Data');
    expect(serialized).not.toContain('base64_data');
  });
});
