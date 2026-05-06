#!/usr/bin/env node
import { runBpmnWorkerFromEnv } from '../run.js';

runBpmnWorkerFromEnv().catch((cause) => {
  console.error(cause);
  process.exitCode = 1;
});
