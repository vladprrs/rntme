import * as React from 'react';
import mermaid from 'mermaid';

export type MermaidProps = { chart: string };

export function Mermaid(props: MermaidProps): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
    const id = `m${Math.random().toString(36).slice(2)}`;
    void mermaid.render(id, props.chart).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    });
  }, [props.chart]);
  return React.createElement('div', { ref, className: 'rntme-mermaid' });
}
