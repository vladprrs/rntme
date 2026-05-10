import { describe, expect, it } from 'bun:test';
import { proto } from '../src/index.js';

const { ContentBlock, ContentBlockType } = proto.rntme.contracts.ai_llm.v1;

describe('ContentBlock oneof variants round-trip', () => {
  it('TEXT block', () => {
    const round = ContentBlock.decode(
      ContentBlock.encode(ContentBlock.create({ type: ContentBlockType.CONTENT_BLOCK_TYPE_TEXT, text: { text: 'hi' } })).finish(),
    );
    expect(round.text?.text).toBe('hi');
  });

  it('IMAGE block via URL', () => {
    const round = ContentBlock.decode(
      ContentBlock.encode(
        ContentBlock.create({
          type: ContentBlockType.CONTENT_BLOCK_TYPE_IMAGE,
          image: { url: 'https://example.com/x.png', media_type: 'image/png' },
        }),
      ).finish(),
    );
    expect(round.image?.url).toBe('https://example.com/x.png');
    expect(round.image?.media_type).toBe('image/png');
  });

  it('IMAGE block via base64_data', () => {
    const round = ContentBlock.decode(
      ContentBlock.encode(
        ContentBlock.create({
          type: ContentBlockType.CONTENT_BLOCK_TYPE_IMAGE,
          image: { base64_data: new Uint8Array([1, 2, 3]), media_type: 'image/jpeg' },
        }),
      ).finish(),
    );
    expect(Array.from(round.image?.base64_data ?? [])).toEqual([1, 2, 3]);
  });

  it('AUDIO block with transcript', () => {
    const round = ContentBlock.decode(
      ContentBlock.encode(
        ContentBlock.create({
          type: ContentBlockType.CONTENT_BLOCK_TYPE_AUDIO,
          audio: { url: 'https://example.com/call.mp3', media_type: 'audio/mpeg', transcript: 'Hello caller' },
        }),
      ).finish(),
    );
    expect(round.audio?.transcript).toBe('Hello caller');
  });

  it('FILE block via vendor_file_id', () => {
    const round = ContentBlock.decode(
      ContentBlock.encode(
        ContentBlock.create({
          type: ContentBlockType.CONTENT_BLOCK_TYPE_FILE,
          file: { vendor_file_id: 'file-abc', media_type: 'application/pdf', filename: 'report.pdf' },
        }),
      ).finish(),
    );
    expect(round.file?.vendor_file_id).toBe('file-abc');
    expect(round.file?.filename).toBe('report.pdf');
  });

  it('TOOL_USE block', () => {
    const round = ContentBlock.decode(
      ContentBlock.encode(
        ContentBlock.create({
          type: ContentBlockType.CONTENT_BLOCK_TYPE_TOOL_USE,
          tool_use: { id: 'tu-1', name: 'lookup_user', arguments: { fields: { id: { stringValue: 'u-42' } } } },
        }),
      ).finish(),
    );
    expect(round.tool_use?.name).toBe('lookup_user');
  });

  it('TOOL_RESULT block', () => {
    const round = ContentBlock.decode(
      ContentBlock.encode(
        ContentBlock.create({
          type: ContentBlockType.CONTENT_BLOCK_TYPE_TOOL_RESULT,
          tool_result: {
            tool_call_id: 'tu-1',
            output: { fields: { name: { stringValue: 'Alice' } } },
            is_error: false,
          },
        }),
      ).finish(),
    );
    expect(round.tool_result?.tool_call_id).toBe('tu-1');
    expect(round.tool_result?.is_error).toBe(false);
  });

  it('THINKING block', () => {
    const round = ContentBlock.decode(
      ContentBlock.encode(
        ContentBlock.create({
          type: ContentBlockType.CONTENT_BLOCK_TYPE_THINKING,
          thinking: { text: 'Let me think...', redacted: false },
        }),
      ).finish(),
    );
    expect(round.thinking?.text).toBe('Let me think...');
  });

  it('THINKING block with redacted=true', () => {
    const round = ContentBlock.decode(
      ContentBlock.encode(
        ContentBlock.create({
          type: ContentBlockType.CONTENT_BLOCK_TYPE_THINKING,
          thinking: { text: '', redacted: true },
        }),
      ).finish(),
    );
    expect(round.thinking?.redacted).toBe(true);
  });
});
