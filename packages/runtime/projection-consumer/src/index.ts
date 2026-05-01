export const VERSION = '0.0.0';

// Types
export type { KafkaBatch, ConsumedMessage, KafkaConsumer } from './types/consumer.js';
export type {
  ApplyPlan,
  CompiledHandler,
  MirrorHandler,
  DerivedHandler,
  ColumnBinding,
  ApplyResult,
} from './types/apply.js';
export { ApplyCompileError } from './types/errors.js';
export type { ApplyCompileErrorCode } from './types/errors.js';

// Kafka
export { createInMemoryKafkaConsumer } from './kafka/in-memory.js';
export type { InMemoryKafkaConsumer } from './kafka/in-memory.js';

// Bootstrap + apply
export { bootstrapProjections } from './store/bootstrap.js';
export { compileApplyPlan } from './apply/compile.js';
export { bindValues, bindDerivedValue } from './apply/bind.js';
export { applyEvent } from './apply/apply-event.js';

// Consumer
export { createProjectionConsumer } from './consumer.js';
export type { ProjectionConsumer, ProjectionConsumerOptions } from './consumer.js';
