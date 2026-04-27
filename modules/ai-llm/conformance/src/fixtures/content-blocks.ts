/**
 * One ContentBlock fixture per canonical type. media references in IMAGE / AUDIO / FILE
 * blocks point at the local binary fixtures from media/.
 */

import { samplePngUrl, sampleMp3Url, samplePdfUrl } from './media/index.js';

export const textBlock = { type: 1, text: { text: 'Hello, world!' } };

export const imageBlockUrl = {
  type: 2,
  image: { url: samplePngUrl, media_type: 'image/png' },
};

export const audioBlockUrl = {
  type: 3,
  audio: { url: sampleMp3Url, media_type: 'audio/mpeg', transcript: '' },
};

export const fileBlockUrl = {
  type: 4,
  file: { url: samplePdfUrl, media_type: 'application/pdf', filename: 'sample.pdf' },
};

export const toolUseBlock = {
  type: 5,
  tool_use: {
    id: 'tu_fixture_1',
    name: 'get_weather',
    arguments: { fields: { city: { stringValue: 'Berlin' } } },
  },
};

export const toolResultBlock = {
  type: 6,
  tool_result: {
    tool_call_id: 'tu_fixture_1',
    output: { fields: { temp_c: { numberValue: 18 } } },
    is_error: false,
  },
};

export const thinkingBlock = {
  type: 7,
  thinking: { text: 'Let me reason about this...', redacted: false },
};
