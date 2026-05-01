import type { CompiledScreen } from '@rntme/ui';

export const testLayout: CompiledScreen = {
  spec: {
    root: 'shell',
    elements: {
      shell: { type: 'Stack', props: { direction: 'vertical', gap: 'lg' }, children: ['header'] },
      header: { type: 'Heading', props: { level: 1, text: 'Test App' } },
    },
  },
};

export const testScreen: CompiledScreen = {
  spec: {
    root: 'page',
    elements: {
      page: { type: 'Heading', props: { level: 1, text: 'Home' } },
    },
  },
};
