import type { Expr } from './authoring.js';
import type { ActorRef } from '@rntme/pdm';

/** Mirrors `CompileResult` from the package entrypoint without importing it (avoids cycles). */
export type ReadPreludeCompileResult = {
  sql: string;
  paramOrder: string[];
  shape: { name: string };
  optionalParams: string[];
  paramDefaults: Record<string, unknown>;
};

export type CommandResult = {
  aggregateId: string;
  version: number;
  eventIds: string[];
};

export type EmitPlan = {
  nodeId: string;
  aggregate: string;
  aggregateIdExpr: Expr;
  transition: string;
  eventType: string;
  affects: readonly string[];
  payloadExprs: Record<string, Expr>;
  actorExpr?: Expr;
  isCreation: boolean;
  isSelfLoop: boolean;
  fromStates: readonly (string | null)[];
  toState: string;
};

export type CompiledCommand = {
  graphId: string;
  aggregate: string;
  emits: EmitPlan[];
  readPrelude: ReadPreludeCompileResult | null;
  readPreludeGuardNodeId: string | null;
  paramOrder: string[];
  optionalParams: string[];
  paramDefaults: Record<string, unknown>;
};

export type RuntimeActor = ActorRef | null;
