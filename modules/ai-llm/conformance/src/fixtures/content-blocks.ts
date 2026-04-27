/**
 * One ContentBlock fixture per canonical type. media references in IMAGE / AUDIO / FILE
 * blocks point at the local binary fixtures from media/.
 */

import { proto } from '@rntme/contracts-ai-llm-v1';
import { samplePngUrl, sampleMp3Url, samplePdfUrl } from './media/index.js';

const { ContentBlockType } = proto.rntme.contracts.ai_llm.v1;

export const textBlock = {
  type: ContentBlockType.CONTENT_BLOCK_TYPE_TEXT,
  text: { text: 'Hello, world!' },
};

export const imageBlockUrl = {
  type: ContentBlockType.CONTENT_BLOCK_TYPE_IMAGE,
  image: { url: samplePngUrl, media_type: 'image/png' },
};

export const audioBlockUrl = {
  type: ContentBlockType.CONTENT_BLOCK_TYPE_AUDIO,
  audio: { url: sampleMp3Url, media_type: 'audio/mpeg', transcript: '' },
};

export const fileBlockUrl = {
  type: ContentBlockType.CONTENT_BLOCK_TYPE_FILE,
  file: { url: samplePdfUrl, media_type: 'application/pdf', filename: 'sample.pdf' },
};

export const toolUseBlock = {
  type: ContentBlockType.CONTENT_BLOCK_TYPE_TOOL_USE,
  tool_use: {
    id: 'tu_fixture_1',
    name: 'get_weather',
    arguments: { fields: { city: { stringValue: 'Berlin' } } },
  },
};

export const toolResultBlock = {
  type: ContentBlockType.CONTENT_BLOCK_TYPE_TOOL_RESULT,
  tool_result: {
    tool_call_id: 'tu_fixture_1',
    output: { fields: { temp_c: { numberValue: 18 } } },
    is_error: false,
  },
};

export const thinkingBlock = {
  type: ContentBlockType.CONTENT_BLOCK_TYPE_THINKING,
  thinking: { text: 'Let me reason about this...', redacted: false },
};
