import { Buffer } from 'node:buffer';
import { fromCloudEventWire, type EventEnvelope, type KafkaMessage } from '@rntme/event-store';
import type { WorkflowEventRef } from '@rntme/workflows';
import type { PlannedWorkflowSubscriptionInput, WorkflowEventConsumer } from './types.js';

type KafkaJsMessage = {
  readonly key?: Buffer | null;
  readonly value?: Buffer | null;
  readonly headers?: Record<string, Buffer | string | readonly (Buffer | string)[] | undefined>;
};

export function decodeKafkaJsMessage(message: KafkaJsMessage): EventEnvelope {
  const wire: KafkaMessage = {
    topic: '',
    key: message.key?.toString('utf8') ?? '',
    value: message.value?.toString('utf8') ?? '{}',
    headers: Object.fromEntries(
      Object.entries(message.headers ?? {}).map(([key, value]) => [
        key,
        headerValueToString(value),
      ]),
    ),
  };
  return fromCloudEventWire(wire);
}

export async function createKafkaWorkflowConsumer(input: {
  readonly brokers: readonly string[];
  readonly clientId: string;
  readonly groupId: string;
  readonly subscriptions: readonly PlannedWorkflowSubscriptionInput[];
}): Promise<WorkflowEventConsumer> {
  const { Kafka } = await import('kafkajs');
  const kafka = new Kafka({ clientId: input.clientId, brokers: [...input.brokers] });
  const consumer = kafka.consumer({ groupId: input.groupId });
  const queue: Array<{ envelope: EventEnvelope; eventRef: WorkflowEventRef; commit: () => Promise<void> }> = [];
  let waiter: (() => void) | null = null;
  const byTopic = subscriptionsByTopic(input.subscriptions);

  await consumer.connect();
  for (const topic of [...byTopic.keys()].sort()) {
    await consumer.subscribe({ topic, fromBeginning: true });
  }
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const subs = byTopic.get(topic) ?? [];
      const envelope = decodeKafkaJsMessage(message);
      const sub = subs.find((candidate) =>
        candidate.service === serviceFromEnvelope(envelope) &&
        candidate.aggregateType === envelope.rntAggregateType &&
        candidate.eventType === envelope.eventType,
      );
      if (sub === undefined) return;
      queue.push({
        envelope,
        eventRef: { service: sub.service, aggregateType: sub.aggregateType, eventType: sub.eventType },
        commit: async () => undefined,
      });
      waiter?.();
      waiter = null;
    },
  });

  return {
    async *events() {
      while (true) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            waiter = resolve;
          });
        }
        const next = queue.shift();
        if (next !== undefined) yield next;
      }
    },
    stop: async () => {
      await consumer.disconnect();
    },
  };
}

function subscriptionsByTopic(
  subscriptions: readonly PlannedWorkflowSubscriptionInput[],
): Map<string, PlannedWorkflowSubscriptionInput[]> {
  const out = new Map<string, PlannedWorkflowSubscriptionInput[]>();
  for (const sub of subscriptions) {
    const list = out.get(sub.topic) ?? [];
    list.push(sub);
    out.set(sub.topic, list);
  }
  return out;
}

function serviceFromEnvelope(envelope: EventEnvelope): string {
  const parts = envelope.type.split('.');
  return parts[0] ?? '';
}

function headerValueToString(value: Buffer | string | readonly (Buffer | string)[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value;
  if (Buffer.isBuffer(first)) return first.toString('utf8');
  return String(first ?? '');
}
