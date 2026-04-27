/**
 * Thread / ThreadItem fixtures. Used by Thread.* scenarios.
 */

import { systemHelpful, userMath } from './messages.js';

export const supportThread = {
  title: 'Customer support session',
  initial_messages: [systemHelpful],
  metadata: {
    public: { fields: { tag: { stringValue: 'support' } } },
  },
};

export const mathThread = {
  title: 'Math tutor session',
  initial_messages: [systemHelpful, userMath],
};

export const emptyThread = {
  title: 'Empty thread',
  initial_messages: [],
};
