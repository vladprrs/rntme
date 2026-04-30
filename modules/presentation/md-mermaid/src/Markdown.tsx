import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type MarkdownProps = { content: string };

export function Markdown(props: MarkdownProps): React.ReactElement {
  return React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, props.content);
}
