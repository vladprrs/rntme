export function defaultTopicOf(aggregateType: string): string {
  return `rntme.${aggregateType.toLowerCase()}.v1`;
}
