import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type MigrationJournal = {
  readonly entries: readonly { readonly tag: string }[];
};

describe('Drizzle migration journal', () => {
  it('registers every top-level SQL migration file', () => {
    const packageRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
    const migrationsDir = join(packageRoot, 'drizzle');
    const sqlTags = readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => basename(name, '.sql'))
      .sort();
    const journal = JSON.parse(
      readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8'),
    ) as MigrationJournal;
    const journalTags = journal.entries.map((entry) => entry.tag).sort();

    expect(journalTags).toEqual(sqlTags);
  });
});
