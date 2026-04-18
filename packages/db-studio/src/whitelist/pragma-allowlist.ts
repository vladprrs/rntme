export const READ_ONLY_PRAGMAS = [
  'table_info',
  'table_list',
  'index_list',
  'index_info',
  'foreign_key_list',
  'schema_version',
  'user_version',
  'database_list',
  'compile_options',
  'page_count',
  'page_size',
  'integrity_check',
] as const;

const SET = new Set<string>(READ_ONLY_PRAGMAS);

export function isReadOnlyPragma(pragmaArgs: string): boolean {
  const trimmed = pragmaArgs.trim();
  // Extract pragma name: either "name" or "name(args)".
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(\(.*\))?\s*$/);
  if (!match) return false; // rejects "name = value" assignment forms
  const name = match[1]!.toLowerCase();
  return SET.has(name);
}
