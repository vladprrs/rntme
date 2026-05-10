import { describe, it, expect } from 'bun:test';
import { HttpUrlSchema } from '@rntme/platform-core';

describe('HttpUrlSchema', () => {
  it('accepts http and https URLs', () => {
    expect(HttpUrlSchema.safeParse('https://example.com/').success).toBe(true);
    expect(HttpUrlSchema.safeParse('http://localhost:8080/').success).toBe(true);
  });

  it('rejects ftp/file/other protocols', () => {
    expect(HttpUrlSchema.safeParse('ftp://example.com/').success).toBe(false);
    expect(HttpUrlSchema.safeParse('file:///tmp/x').success).toBe(false);
    expect(HttpUrlSchema.safeParse('not-a-url').success).toBe(false);
  });
});
