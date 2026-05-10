import { describe, expect, it } from 'bun:test';
import * as React from 'react';
import { createOperationRegistry, RegistryProvider } from '@rntme/contracts-client-runtime-v1';
import { renderToStaticMarkup } from 'react-dom/server';
import { RichTextEditor } from '../src/RichTextEditor.js';

describe('RichTextEditor', () => {
  it('renders inside RegistryProvider', () => {
    const reg = createOperationRegistry();
    const h = renderToStaticMarkup(
      React.createElement(
        RegistryProvider,
        { value: reg },
        React.createElement(RichTextEditor, { __rntmeElementId: 'editor1' }),
      ),
    );
    expect(h).toContain('rntme-richtext');
  });
});
