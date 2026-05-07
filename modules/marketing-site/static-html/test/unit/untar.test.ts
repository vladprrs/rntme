import { describe, expect, it } from 'vitest';
import { untarToDir } from '../../src/untar.js';
import { makeBundle } from './helpers.js';

describe('untarToDir', () => {
  it('extracts and returns the dir when index.html is present', async () => {
    const { bytes } = await makeBundle({ 'index.html': '<h1>x</h1>' });

    const result = await untarToDir(bytes);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.hasIndex).toBe(true);
  });

  it('returns INDEX_HTML_MISSING otherwise', async () => {
    const { bytes } = await makeBundle({ 'about.html': 'x' });

    const result = await untarToDir(bytes);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('MARKETING_SITE_PROVISION_INDEX_HTML_MISSING');
  });
});
