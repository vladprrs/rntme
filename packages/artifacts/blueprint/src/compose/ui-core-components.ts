import type { ComponentInfo } from '@rntme/ui';

const CORE_COMPONENTS: Readonly<Record<string, ComponentInfo>> = {
  // Existing shadcn-backed primitives
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

  // Editorial dashboard primitives (registered in @rntme/ui-runtime)
  Box: { childrenModel: 'list', props: {} },
  PageContainer: { childrenModel: 'list', props: {} },
  PageHeader: { childrenModel: 'none', props: {} },
  Panel: { childrenModel: 'list', props: {} },
  DashGrid: { childrenModel: 'list', props: {} },
  SummaryGrid: { childrenModel: 'none', props: {} },
  StatusBadge: { childrenModel: 'none', props: {} },
  ServicesPanel: { childrenModel: 'none', props: {} },
  Timeline: { childrenModel: 'none', props: {} },
  AlertList: { childrenModel: 'none', props: {} },
  Banner: { childrenModel: 'none', props: {} },
  EmptyState: { childrenModel: 'none', props: {} },
  Sidebar: { childrenModel: 'none', props: {} },
  Topbar: { childrenModel: 'none', props: {} },
};

export function resolveCoreComponent(type: string): ComponentInfo | undefined {
  return CORE_COMPONENTS[type];
}
