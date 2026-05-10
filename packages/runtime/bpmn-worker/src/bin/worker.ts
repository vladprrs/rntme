#!/usr/bin/env bun
import { runBpmnWorkerFromEnv } from '../run.js';

runBpmnWorkerFromEnv().catch((cause) => {
  process.stderr.write(`${cause instanceof Error ? cause.stack ?? cause.message : String(cause)}\n`);
  process.exitCode = 1;
});
