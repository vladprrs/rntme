import { describe, expect, it } from 'bun:test';
import { buildOpenRouterRequest } from '../../src/completion-mapper.js';

describe('buildOpenRouterRequest — text-only', () => {
  it('strips the openrouter/ prefix from model and emits one user text message', () => {
    const proto = {
      model: 'openrouter/openai/gpt-4o',
      messages: [
        {
          role: 'user',
          content: [{ type: 1 /* TEXT */, text: { text: 'hello' } }],
        },
      ],
    };
    const req = buildOpenRouterRequest(proto);
    expect(req.model).toBe('openai/gpt-4o');
    expect(req.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ]);
  });

  it('rejects model not starting with openrouter/', () => {
    expect(() =>
      buildOpenRouterRequest({
        model: 'openai/gpt-4o',
        messages: [{ role: 'user', content: [{ type: 1, text: { text: 'x' } }] }],
      }),
    ).toThrowError(/AI_LLM_STRUCTURAL_VENDOR_MISMATCH|vendor mismatch/i);
  });
});

describe('buildOpenRouterRequest — image and file content blocks', () => {
  it('maps IMAGE base64 to image_url with data: URI', () => {
    const req = buildOpenRouterRequest({
      model: 'openrouter/openai/gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 2 /* IMAGE */,
              image: { base64Data: 'aGVsbG8=', mediaType: 'image/png' },
            },
          ],
        },
      ],
    });
    expect(req.messages[0]!.content).toEqual([{
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,aGVsbG8=' },
    }]);
  });

  it('maps IMAGE url to image_url with the url verbatim', () => {
    const req = buildOpenRouterRequest({
      model: 'openrouter/openai/gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 2 /* IMAGE */, image: { url: 'https://example.com/x.png', mediaType: 'image/png' } },
          ],
        },
      ],
    });
    expect(req.messages[0]!.content).toEqual([{
      type: 'image_url',
      image_url: { url: 'https://example.com/x.png' },
    }]);
  });

  it('maps FILE base64 PDF to {type:file,file:{filename,file_data}}', () => {
    const req = buildOpenRouterRequest({
      model: 'openrouter/openai/gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 4 /* FILE */,
              file: {
                base64Data: 'JVBERi0=',
                mediaType: 'application/pdf',
                filename: 'r.pdf',
              },
            },
          ],
        },
      ],
    });
    expect(req.messages[0]!.content).toEqual([{
      type: 'file',
      file: { filename: 'r.pdf', file_data: 'data:application/pdf;base64,JVBERi0=' },
    }]);
  });

  it('maps snake_case FILE url objects from gRPC deserialization', () => {
    const req = buildOpenRouterRequest({
      model: 'openrouter/openai/gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 4 /* FILE */,
              file: {
                url: 'https://files.example/resume.pdf',
                media_type: 'application/pdf',
                filename: 'r.pdf',
              },
            },
          ],
        },
      ],
    });
    expect(req.messages[0]!.content).toEqual([{
      type: 'file',
      file: { filename: 'r.pdf', file_data: 'https://files.example/resume.pdf' },
    }]);
  });
});

describe('buildOpenRouterRequest — sampling and response format', () => {
  it('forwards basic sampling fields', () => {
    const req = buildOpenRouterRequest({
      model: 'openrouter/openai/gpt-4o',
      messages: [{ role: 'user', content: [{ type: 1, text: { text: 'x' } }] }],
      sampling: { temperature: 0.2, maxTokens: 1024, topP: 0.9 },
    });
    expect(req.temperature).toBe(0.2);
    expect(req.max_tokens).toBe(1024);
    expect(req.top_p).toBe(0.9);
  });

  it('maps response_format=json_schema with response_schema', () => {
    const schema = { type: 'object', properties: { x: { type: 'string' } } };
    const req = buildOpenRouterRequest({
      model: 'openrouter/openai/gpt-4o',
      messages: [{ role: 'user', content: [{ type: 1, text: { text: 'x' } }] }],
      sampling: { responseFormat: 'json_schema', responseSchema: schema },
    });
    expect(req.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'schema', schema, strict: true },
    });
  });

  it('maps snake_case sampling objects from gRPC deserialization', () => {
    const schema = { type: 'object', properties: { x: { type: 'string' } } };
    const req = buildOpenRouterRequest({
      model: 'openrouter/openai/gpt-4o',
      messages: [{ role: 'user', content: [{ type: 1, text: { text: 'x' } }] }],
      sampling: {
        response_format: 'json_schema',
        response_schema: schema,
        max_tokens: 512,
        top_p: 0.8,
      },
    });
    expect(req.max_tokens).toBe(512);
    expect(req.top_p).toBe(0.8);
    expect(req.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'schema', schema, strict: true },
    });
  });

  it('maps protobuf Struct response_schema to plain JSON schema', () => {
    const protoSchema = {
      fields: {
        type: { stringValue: 'object' },
        additionalProperties: { boolValue: false },
        required: { listValue: { values: [{ stringValue: 'full_name' }] } },
        properties: {
          structValue: {
            fields: {
              full_name: {
                structValue: {
                  fields: {
                    type: { stringValue: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    };
    const req = buildOpenRouterRequest({
      model: 'openrouter/openai/gpt-4o',
      messages: [{ role: 'user', content: [{ type: 1, text: { text: 'x' } }] }],
      sampling: {
        response_format: 'json_schema',
        response_schema: protoSchema,
      },
    });
    expect(req.response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['full_name'],
          properties: { full_name: { type: 'string' } },
        },
        strict: true,
      },
    });
  });

  it('maps response_format=json_object', () => {
    const req = buildOpenRouterRequest({
      model: 'openrouter/openai/gpt-4o',
      messages: [{ role: 'user', content: [{ type: 1, text: { text: 'x' } }] }],
      sampling: { responseFormat: 'json_object' },
    });
    expect(req.response_format).toEqual({ type: 'json_object' });
  });
});
