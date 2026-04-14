const PLACEHOLDER_RE = /\{([^/}]+)\}/g;

export function honoPath(openApiPath: string): string {
  return openApiPath.replace(PLACEHOLDER_RE, ':$1');
}
