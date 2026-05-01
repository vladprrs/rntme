export type KafkaMessage = Readonly<{
  topic: string;
  key: string;
  headers: Readonly<Record<string, string>>;
  value: string;
}>;

export interface KafkaProducer {
  send(message: KafkaMessage): Promise<void>;
}
