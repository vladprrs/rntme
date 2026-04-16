import type { CompiledScreen } from '@rntme/ui';

export const testLayout: CompiledScreen = {
  spec: {
    root: 'shell',
    elements: {
      shell: { type: 'Stack', props: { direction: 'vertical' }, children: ['slot-main'] },
      'slot-main': { type: 'Slot', props: { name: 'main' } },
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
