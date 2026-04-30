import * as React from 'react';
import mermaid from 'mermaid';

export type MermaidProps = { source: string };

export function Mermaid(props: MermaidProps): React.ReactElement {
  const ref = React.useRef<React.ElementRef<'div'>>(null);
  React.useEffect(() => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    const id = `m${Math.random().toString(36).slice(2)}`;
    void mermaid.render(id, props.source).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    });
  }, [props.source]);
  return React.createElement('div', { ref, className: 'rntme-mermaid' });
}
