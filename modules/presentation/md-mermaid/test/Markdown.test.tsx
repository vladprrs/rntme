import { describe, expect, it } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../src/Markdown.js';

describe('Markdown', () => {
  it('renders markdown text', () => {
    const h = renderToStaticMarkup(React.createElement(Markdown, { content: '# Hi' }));
    expect(h).toContain('Hi');
  });
});
