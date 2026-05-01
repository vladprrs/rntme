export function defaultTopicOf(serviceName: string, aggregateType: string): string {
  return `rntme.${serviceName.toLowerCase()}.${aggregateType.toLowerCase()}`;
}
