/**
 * UI artifact for the issue-tracker-api demo.
 * Served at `/ui` (see `@rntme/ui-runtime`).
 *
 * Routes:
 *   /issues        — stats by project + navigation
 *   /issues/browse — issue list (listIssues)
 *   /issues/new    — report issue (reportIssue)
 *   /issues/:id    — detail + lifecycle actions (submit / assign / resolve / close)
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
      metadata: { title: 'Home' },
      page: {
        root: 'page-root',
        elements: {
          'page-root': {
            type: 'Stack',
            props: { direction: 'vertical', gap: 4 },
            children: ['issues-heading', 'nav-row', 'stats-table'],
          },
          'issues-heading': {
            type: 'Heading',
            props: { level: 2, text: 'Issues by Project' },
            children: [],
          },
          'nav-row': {
            type: 'Stack',
            props: { direction: 'horizontal', gap: 2 },
            children: ['btn-browse', 'btn-new'],
          },
          'btn-browse': {
            type: 'Button',
            props: { label: 'Browse issues' },
            children: [],
            watch: { click: { action: 'goBrowse' } },
          },
          'btn-new': {
            type: 'Button',
            props: { label: 'Report issue', variant: 'primary' },
            children: [],
            watch: { click: { action: 'goNew' } },
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
        goBrowse: {
          kind: 'navigation',
          navigateTo: '/issues/browse',
        },
        goNew: {
          kind: 'navigation',
          navigateTo: '/issues/new',
        },
      },
    },

    '/issues/browse': {
      layout: 'main',
      metadata: { title: 'Browse' },
      page: {
        root: 'browse-root',
        elements: {
          'browse-root': {
            type: 'Stack',
            props: { direction: 'vertical', gap: 4 },
            children: ['btn-home', 'browse-heading', 'browse-hint', 'open-form', 'list-table'],
          },
          'btn-home': {
            type: 'Button',
            props: { label: '← Home' },
            children: [],
            watch: { click: { action: 'goHome' } },
          },
          'browse-heading': {
            type: 'Heading',
            props: { level: 2, text: 'Recent issues' },
            children: [],
          },
          'browse-hint': {
            type: 'Text',
            props: {
              text: 'Open an issue by ID (seeded ids include 101–122).',
            },
            children: [],
          },
          'open-form': {
            type: 'Form',
            props: { statePath: '/form' },
            children: ['open-row'],
          },
          'open-row': {
            type: 'Stack',
            props: { direction: 'horizontal', gap: 2 },
            children: ['field-open-id', 'btn-open'],
          },
          'field-open-id': {
            type: 'FormField',
            props: { name: 'openId', label: 'Issue ID', type: 'number' },
            children: [],
          },
          'btn-open': {
            type: 'Button',
            props: { label: 'Open', variant: 'primary' },
            children: [],
            watch: { click: { action: 'goDetail' } },
          },
          'list-table': {
            type: 'Table',
            props: {
              rows: { $state: '/data/issues' },
              columns: ['id', 'title', 'status', 'priority', 'storyPoints'],
            },
            children: [],
          },
        },
      },
      data: {
        issues: {
          binding: 'listIssuesUi',
          params: { limit: 50 },
          refetchOn: ['mount'],
        },
      },
      actions: {
        goHome: {
          kind: 'navigation',
          navigateTo: '/issues',
        },
        goDetail: {
          kind: 'navigation',
          navigateTo: '/issues/:id',
          paramsFromState: {
            id: '/form/openId',
          },
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
            navigateTo: '/issues/browse',
          },
          onError: { showAlert: true },
        },
      },
    },

    '/issues/:id': {
      layout: 'main',
      metadata: { title: 'Issue detail' },
      page: {
        root: 'detail-root',
        elements: {
          'detail-root': {
            type: 'Stack',
            props: { direction: 'vertical', gap: 4 },
            children: [
              'detail-heading',
              'detail-table',
              'detail-actions',
              'form-submit',
              'form-assign',
              'form-resolve',
              'row-close',
            ],
          },
          'detail-heading': {
            type: 'Heading',
            props: { level: 2, text: 'Issue' },
            children: [],
          },
          'detail-table': {
            type: 'Table',
            props: {
              rows: { $state: '/data/detail' },
              columns: [
                'id',
                'title',
                'status',
                'priority',
                'projectKey',
                'assigneeUsername',
                'reporterUsername',
              ],
            },
            children: [],
          },
          'detail-actions': {
            type: 'Text',
            props: {
              text: 'Lifecycle: Submit (draft→open), Assign, Resolve (in progress→resolved), Close (resolved→closed).',
            },
            children: [],
          },
          'form-submit': {
            type: 'Stack',
            props: { direction: 'horizontal', gap: 2 },
            children: ['btn-submit'],
          },
          'btn-submit': {
            type: 'Button',
            props: { label: 'Submit (draft → open)' },
            children: [],
            watch: { click: { action: 'cmdSubmit' } },
          },
          'form-assign': {
            type: 'Form',
            props: { statePath: '/form' },
            children: ['field-assignee', 'btn-assign'],
          },
          'field-assignee': {
            type: 'FormField',
            props: { name: 'assigneeId', label: 'Assignee user ID', type: 'number' },
            children: [],
          },
          'btn-assign': {
            type: 'Button',
            props: { label: 'Assign / reassign', variant: 'primary' },
            children: [],
            watch: { click: { action: 'cmdAssign' } },
          },
          'form-resolve': {
            type: 'Form',
            props: { statePath: '/form' },
            children: ['field-resolvedAt', 'btn-resolve'],
          },
          'field-resolvedAt': {
            type: 'FormField',
            props: {
              name: 'resolvedAt',
              label: 'Resolved at (ISO-8601)',
              type: 'text',
            },
            children: [],
          },
          'btn-resolve': {
            type: 'Button',
            props: { label: 'Resolve' },
            children: [],
            watch: { click: { action: 'cmdResolve' } },
          },
          'row-close': {
            type: 'Stack',
            props: { direction: 'horizontal', gap: 2 },
            children: ['btn-close'],
          },
          'btn-close': {
            type: 'Button',
            props: { label: 'Close' },
            children: [],
            watch: { click: { action: 'cmdClose' } },
          },
        },
      },
      data: {
        detail: {
          binding: 'issueDetail',
          params: { id: { $state: '/route/params/id' } },
          refetchOn: ['mount'],
        },
      },
      actions: {
        cmdSubmit: {
          kind: 'command',
          binding: 'submitIssue',
          paramsFromState: {
            issueId: '/route/params/id',
          },
          onSuccess: { refetchData: ['detail'] },
          onError: { showAlert: true },
        },
        cmdAssign: {
          kind: 'command',
          binding: 'assignIssue',
          paramsFromState: {
            issueId: '/route/params/id',
            assigneeId: '/form/assigneeId',
          },
          onSuccess: { refetchData: ['detail'] },
          onError: { showAlert: true },
        },
        cmdResolve: {
          kind: 'command',
          binding: 'resolveIssue',
          paramsFromState: {
            issueId: '/route/params/id',
            resolvedAt: '/form/resolvedAt',
          },
          onSuccess: { refetchData: ['detail'] },
          onError: { showAlert: true },
        },
        cmdClose: {
          kind: 'command',
          binding: 'closeIssue',
          paramsFromState: {
            issueId: '/route/params/id',
          },
          onSuccess: { refetchData: ['detail'] },
          onError: { showAlert: true },
        },
      },
    },
  },
};
