export function defaultTopicOf(serviceName: string, aggregateType: string): string {
  return `rntme.${serviceName}.${aggregateType.toLowerCase()}.v1`;
}
