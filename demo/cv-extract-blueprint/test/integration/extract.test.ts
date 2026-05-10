import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, mock } from 'bun:test';
import { createOpenRouterModule, createIdempotencyStore } from '@rntme/ai-llm-openrouter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(__dirname, '../fixtures/sample-resume.pdf')).toString('base64');

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

describe('cv-extract demo: openrouter module integration', () => {
  it('produces a structured Completion for the resume fixture', async () => {
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
      now: () => Date.parse('2026-05-06T10:00:00Z'),
    });

    const completion = (await mod.Complete!({
      context: { idempotencyKey: 'cv-test-1' },
      model: 'openrouter/openai/gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 4, file: { filename: 'sample-resume.pdf', mediaType: 'application/pdf', base64Data: FIXTURE } },
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

    // The OR client received a properly shaped request.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('openai/gpt-4o');
    expect(body.response_format.type).toBe('json_schema');
  });
});
