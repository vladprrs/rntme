export function quoteIdent(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}

export function escapeStringLiteral(s: string): string {
  return s.replace(/'/g, "''");
}
