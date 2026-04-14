export const VERSION = '0.0.0';

export { compileApplyPlan } from './apply/compile.js';
export type {
  ApplyPlan, CompiledHandler, ColumnBinding, ApplyResult,
} from './types/apply.js';

export { bootstrapProjections } from './store/bootstrap.js';
export { createInMemoryKafkaConsumer } from './kafka/in-memory.js';
export type { InMemoryKafkaConsumer } from './kafka/in-memory.js';
export type { ConsumedMessage, KafkaBatch, KafkaConsumer } from './types/consumer.js';
export type { ApplyCompileErrorCode } from './types/errors.js';
export { ApplyCompileError } from './types/errors.js';
