export function defaultTopicOf(
  serviceName: string,
  aggregateType: string,
  topicPrefix?: string | null,
): string {
  const suffix = `${serviceName.toLowerCase()}.${aggregateType.toLowerCase()}`;
  const prefix = normalizeTopicPrefix(topicPrefix);
  return prefix === null ? `rntme.${suffix}` : `${prefix}.${suffix}`;
}

export function defaultTopicPatternOf(
  serviceName: string,
  topicPrefix?: string | null,
): string {
  return defaultTopicOf(serviceName, '*', topicPrefix);
}

function normalizeTopicPrefix(topicPrefix: string | null | undefined): string | null {
  if (topicPrefix === null || topicPrefix === undefined) return null;
  const trimmed = topicPrefix.trim().replace(/^\.+|\.+$/g, '');
  return trimmed === '' ? null : trimmed;
}
