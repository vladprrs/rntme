import type { EventEnvelope } from '../types/envelope.js';
import type { KafkaMessage } from './producer.js';
import { CloudEventDecodeError } from './wire-errors.js';

const REQUIRED_HEADERS = [
  'ce_id', 'ce_source', 'ce_type', 'ce_time', 'ce_subject',
  'ce_datacontenttype', 'ce_dataschema', 'ce_correlationid',
  'ce_rntaggregatetype', 'ce_rntaggregateid', 'ce_rntversion',
  'ce_rntschemaversion', 'ce_specversion',
] as const;

export function toCloudEventWire(env: EventEnvelope, topic: string): KafkaMessage {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ce_specversion: '1.0',
    ce_id: env.id,
    ce_source: env.source,
    ce_type: env.type,
    ce_time: env.time,
    ce_subject: env.subject,
    ce_datacontenttype: env.dataContentType,
    ce_dataschema: env.dataSchema,
    ce_correlationid: env.correlationId,
    ce_rntaggregatetype: env.rntAggregateType,
    ce_rntaggregateid: env.rntAggregateId,
    ce_rntversion: String(env.rntVersion),
    ce_rntschemaversion: String(env.rntSchemaVersion),
  };
  if (env.causationId !== null) headers.ce_causationid = env.causationId;
  if (env.commandId !== null) headers.ce_commandid = env.commandId;
  if (env.rntActorKind !== null) headers.ce_rntactorkind = env.rntActorKind;
  if (env.rntActorId !== null) headers.ce_rntactorid = env.rntActorId;
  if (env.traceparent !== null) headers.ce_traceparent = env.traceparent;
  return {
    topic,
    key: env.subject,
    headers,
    value: JSON.stringify(env.data),
  };
}

export function fromCloudEventWire(msg: KafkaMessage): EventEnvelope {
  const h = msg.headers;
  for (const name of REQUIRED_HEADERS) {
    if (!(name in h)) {
      throw new CloudEventDecodeError(
        'EVENT_STORE_WIRE_DECODE_MISSING_ATTR',
        `[MISSING_ATTR] Missing required CloudEvents header "${name}"`,
      );
    }
  }
  if (h.ce_specversion !== '1.0') {
    throw new CloudEventDecodeError(
      'EVENT_STORE_WIRE_DECODE_UNKNOWN_SPEC',
      `[UNKNOWN_SPEC] Unsupported ce_specversion "${h.ce_specversion}"`,
    );
  }
  const version = parseIntStrict(h.ce_rntversion!, 'ce_rntversion');
  const schemaVersion = parseIntStrict(h.ce_rntschemaversion!, 'ce_rntschemaversion');
  const data: unknown = JSON.parse(msg.value);
  const actorKind = h.ce_rntactorkind === undefined ? null : toActorKind(h.ce_rntactorkind);
  return {
    id: h.ce_id!,
    source: h.ce_source!,
    eventType: deriveEventType(h.ce_type!),
    type: h.ce_type!,
    time: h.ce_time!,
    subject: h.ce_subject!,
    dataContentType: 'application/json',
    dataSchema: h.ce_dataschema!,
    data,
    correlationId: h.ce_correlationid!,
    causationId: h.ce_causationid ?? null,
    commandId: h.ce_commandid ?? null,
    rntAggregateType: h.ce_rntaggregatetype!,
    rntAggregateId: h.ce_rntaggregateid!,
    rntVersion: version,
    rntSchemaVersion: schemaVersion,
    rntActorKind: actorKind,
    rntActorId: h.ce_rntactorid ?? null,
    traceparent: h.ce_traceparent ?? null,
  };
}

function parseIntStrict(s: string, attr: string): number {
  if (!/^-?\d+$/.test(s)) {
    throw new CloudEventDecodeError(
      'EVENT_STORE_WIRE_DECODE_INVALID_INT',
      `[INVALID_INT] Header "${attr}" is not a valid integer: "${s}"`,
    );
  }
  return Number(s);
}

function toActorKind(s: string): 'user' | 'system' | 'service' | null {
  if (s === 'user' || s === 'system' || s === 'service') return s;
  return null;
}

function deriveEventType(type: string): string {
  const lastDot = type.lastIndexOf('.');
  return lastDot === -1 ? type : type.slice(lastDot + 1);
}
