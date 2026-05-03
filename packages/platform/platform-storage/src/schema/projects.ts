import { pgTable, uuid, text, timestamp, unique, pgEnum } from 'drizzle-orm/pg-core';
import { organization } from './identity.js';

export const projectStatus = pgEnum('project_status', ['active', 'deleting', 'delete_failed', 'decommissioned']);

export const project = pgTable(
  'project',
  {
    id: uuid('id').primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organization.id),
    slug: text('slug').notNull(),
    displayName: text('display_name').notNull(),
    status: projectStatus('status').notNull().default('active'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uq: unique('project_org_slug_uq').on(t.orgId, t.slug) }),
);
