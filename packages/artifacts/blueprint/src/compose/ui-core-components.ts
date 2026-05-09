import type { ComponentInfo } from '@rntme/ui';

const CORE_COMPONENTS: Readonly<Record<string, ComponentInfo>> = {
  Badge: { childrenModel: 'none', props: {} },
  Button: { childrenModel: 'none', props: {} },
  Card: { childrenModel: 'list', props: {} },
  DataList: { childrenModel: 'none', props: {} },
  DataTable: { childrenModel: 'none', props: {} },
  Heading: { childrenModel: 'none', props: {} },
  Input: { childrenModel: 'none', props: {} },
  Slot: { childrenModel: 'none', props: {} },
  Stack: { childrenModel: 'list', props: {} },
  Text: { childrenModel: 'none', props: {} },
};

export function resolveCoreComponent(type: string): ComponentInfo | undefined {
  return CORE_COMPONENTS[type];
}
