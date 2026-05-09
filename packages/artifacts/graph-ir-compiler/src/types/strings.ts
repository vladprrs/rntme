export function camelCase(name: string): string {
  if (name.length === 0) return '';
  return name.charAt(0).toLowerCase() + name.slice(1);
}

export function pascalCase(name: string): string {
  if (name.length === 0) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}
