import { z } from 'zod';
import type { ResolvedComponent, UiResolvers } from '@rntme/ui-legacy';

// The full shadcn catalog exposed by @json-render/shadcn. We inline a whitelist here
// because the exact import path depends on the @json-render/shadcn API — adjust the
// import when the version is pinned. The test in Task 13 only verifies presence and
// knownListProps for "Button" and "Table".
const KNOWN_LIST_PROPS: Record<string, readonly string[]> = {
  Table: ['rows'],
  List: ['items'],
  Select: ['options'],
};

const NAMES = [
  'Stack', 'Card', 'Heading', 'Text', 'Label', 'Badge', 'Alert',
  'Button', 'Link', 'Input', 'Textarea', 'Select', 'Checkbox',
  'Table', 'List', 'Form', 'FormField', 'Slot', 'Divider',
  'Tabs', 'TabPanel', 'Dialog', 'Skeleton', 'EmptyState',
] as const;

export function buildComponentResolver(): UiResolvers['resolveComponent'] {
  const fallback: ResolvedComponent = {
    propsSchema: z.record(z.string(), z.unknown()),
    childrenModel: 'list',
  };

  const cache = new Map<string, ResolvedComponent>();
  for (const name of NAMES) {
    cache.set(name, {
      ...fallback,
      ...(KNOWN_LIST_PROPS[name] ? { knownListProps: KNOWN_LIST_PROPS[name] } : {}),
    });
  }
  return (t: string) => cache.get(t);
}
