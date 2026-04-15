/**
 * UI artifact for the issue-tracker-api demo.
 * Routes:
 *   /issues     — project stats table (uses issuesByProject, no params required)
 *   /issues/new — report-issue form   (uses reportIssue command)
 */
import type { UiArtifact } from '@rntme/ui';

export const ui: UiArtifact = {
  version: '1.0-rc1',
  pdmRef: 'issue-tracker.domain.v1',
  qsmRef: 'issue-tracker.read.v1',
  graphSpecRef: 'issue-tracker.graphs.v1',
  bindingsRef: 'issue-tracker.bindings.v1',

  metadata: {
    title: { default: 'Issue Tracker', template: '{title} | Issue Tracker' },
    description: 'Demo issue tracker UI',
  },

  layouts: {
    main: {
      spec: {
        root: 'shell',
        elements: {
          shell: {
            type: 'Stack',
            props: { direction: 'vertical', gap: 4 },
            children: ['header', 'slot-main'],
          },
          header: {
            type: 'Heading',
            props: { level: 1, text: 'Issue Tracker' },
            children: [],
          },
          'slot-main': {
            type: 'Slot',
            props: { name: 'main' },
            children: [],
          },
        },
      },
    },
  },

  routes: {
    '/issues': {
      layout: 'main',
      metadata: { title: 'Issues by Project' },
      page: {
        root: 'page-root',
        elements: {
          'page-root': {
            type: 'Stack',
            props: { direction: 'vertical', gap: 4 },
            children: ['issues-heading', 'new-btn', 'stats-table'],
          },
          'issues-heading': {
            type: 'Heading',
            props: { level: 2, text: 'Issues by Project' },
            children: [],
          },
          'new-btn': {
            type: 'Button',
            props: { label: 'Report Issue' },
            children: [],
            watch: {
              click: { action: 'goNew' },
            },
          },
          'stats-table': {
            type: 'Table',
            props: {
              rows: { $state: '/data/stats' },
              columns: ['projectKey', 'issueCount', 'totalStoryPoints'],
            },
            children: [],
          },
        },
      },
      data: {
        stats: {
          binding: 'issuesByProject',
          refetchOn: ['mount'],
        },
      },
      actions: {
        goNew: {
          kind: 'navigation',
          navigateTo: '/issues/new',
        },
      },
    },

    '/issues/new': {
      layout: 'main',
      metadata: { title: 'Report Issue' },
      page: {
        root: 'form-root',
        elements: {
          'form-root': {
            type: 'Stack',
            props: { direction: 'vertical', gap: 4 },
            children: ['form-heading', 'issue-form'],
          },
          'form-heading': {
            type: 'Heading',
            props: { level: 2, text: 'Report a New Issue' },
            children: [],
          },
          'issue-form': {
            type: 'Form',
            props: { statePath: '/form' },
            children: [
              'field-issueId',
              'field-title',
              'field-projectId',
              'field-reporterId',
              'field-priority',
              'field-storyPoints',
              'submit-btn',
            ],
          },
          'field-issueId': {
            type: 'FormField',
            props: { name: 'issueId', label: 'Issue ID', type: 'number' },
            children: [],
          },
          'field-title': {
            type: 'FormField',
            props: { name: 'title', label: 'Title', type: 'text' },
            children: [],
          },
          'field-projectId': {
            type: 'FormField',
            props: { name: 'projectId', label: 'Project ID', type: 'number' },
            children: [],
          },
          'field-reporterId': {
            type: 'FormField',
            props: { name: 'reporterId', label: 'Reporter ID', type: 'number' },
            children: [],
          },
          'field-priority': {
            type: 'FormField',
            props: { name: 'priority', label: 'Priority', type: 'text' },
            children: [],
          },
          'field-storyPoints': {
            type: 'FormField',
            props: { name: 'storyPoints', label: 'Story Points', type: 'number' },
            children: [],
          },
          'submit-btn': {
            type: 'Button',
            props: { label: 'Submit', variant: 'primary' },
            children: [],
            watch: {
              click: { action: 'submit' },
            },
          },
        },
      },
      actions: {
        submit: {
          kind: 'command',
          binding: 'reportIssue',
          paramsFromState: {
            issueId: '/form/issueId',
            title: '/form/title',
            projectId: '/form/projectId',
            reporterId: '/form/reporterId',
            priority: '/form/priority',
            storyPoints: '/form/storyPoints',
          },
          onSuccess: {
            navigateTo: '/issues',
          },
          onError: { showAlert: true },
        },
      },
    },
  },
};
