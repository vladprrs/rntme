import { openSqliteDatabase } from '@rntme/sqlite';
import { describe, expect, it } from 'bun:test';
import {
  compileOperation,
  executeOperation,
  type OperationCallClient,
  type OperationRegistry,
} from '../../src/index.js';

const registry: OperationRegistry = {
  resolve(target) {
    if ('service' in target && target.service === 'customers' && target.operation === 'getCreditStatus') {
      return {
        id: 'service:customers.getCreditStatus',
        target,
        effect: 'read',
        idempotency: 'none',
        inputShape: 'CreditInput',
        outputShape: 'CreditStatus',
      };
    }
    if ('service' in target && target.service === 'files' && target.operation === 'getDownloadUrl') {
      return {
        id: 'service:files.getDownloadUrl',
        target,
        effect: 'read',
        idempotency: 'none',
        inputShape: 'FileInput',
        outputShape: 'DownloadUrl',
      };
    }
    if ('service' in target && target.service === 'ai' && target.operation === 'complete') {
      return {
        id: 'service:ai.complete',
        target,
        effect: 'read',
        idempotency: 'none',
        inputShape: 'CompletionRequest',
        outputShape: 'Completion',
      };
    }
    return null;
  },
};

describe('operation call nodes', () => {
  it('uses call output in branch and result', async () => {
    const graph = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {
        Decision: { fields: { approved: { type: 'boolean', nullable: false } } },
      },
      graphs: {
        decide: {
          id: 'decide',
          signature: {
            inputs: { customerId: { type: 'string', mode: 'required' } },
            output: { type: 'row<Decision>', from: 'out' },
          },
          nodes: [
            {
              id: 'credit',
              type: 'call',
              target: { service: 'customers', operation: 'getCreditStatus' },
              input: { customerId: { $param: 'customerId' } },
              policy: { timeoutMs: 500, onError: 'fail' },
            },
            {
              id: 'out',
              type: 'result',
              value: { approved: { $ref: 'credit.result.approved' } },
            },
          ],
        },
      },
    };

    const compiled = compileOperation(
      graph,
      { entities: {} },
      { projections: {}, relations: {} },
      {
        registry,
        serviceName: 'orders',
        ownedAggregates: new Set(),
        exposure: 'read',
      },
    );
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const calls: unknown[] = [];
    const callClient: OperationCallClient = {
      async call(input) {
        calls.push(input);
        return { ok: true, value: { approved: true } };
      },
    };

    const out = await executeOperation(
      compiled.value,
      { customerId: 'cust-1' },
      {
        qsmDb: openSqliteDatabase({ filename: ':memory:' }),
        eventStore: null,
        callClient,
        now: () => '2026-05-06T00:00:00.000Z',
        nextId: () => 'id',
        actor: null,
        correlation: { commandId: 'cmd', correlationId: 'corr', traceparent: null },
        idempotencyKey: null,
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      policy: { timeoutMs: 500, onError: 'fail' },
    });
    expect(out.value).toEqual({ approved: true });
  });

  it('evaluates nested composite call payloads with params and prior call refs', async () => {
    const graph = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {
        Result: { fields: { ok: { type: 'boolean', nullable: false } } },
      },
      graphs: {
        extract: {
          id: 'extract',
          signature: {
            inputs: { fileId: { type: 'string', mode: 'required' }, filename: { type: 'string', mode: 'required' } },
            output: { type: 'row<Result>', from: 'out' },
          },
          nodes: [
            {
              id: 'download',
              type: 'call',
              target: { service: 'files', operation: 'getDownloadUrl' },
              input: { file_id: { $param: 'fileId' } },
              policy: { timeoutMs: 500, onError: 'fail' },
            },
            {
              id: 'completion',
              type: 'call',
              target: { service: 'ai', operation: 'complete' },
              input: {
                request: {
                  context: { idempotency_key: { $literal: 'idem-1' } },
                  messages: [
                    {
                      role: { $literal: 'user' },
                      content: [
                        {
                          type: { $literal: 4 },
                          file: {
                            filename: { $param: 'filename' },
                            url: { $ref: 'download.result.presigned.url' },
                          },
                        },
                      ],
                    },
                  ],
                },
              },
              policy: { timeoutMs: 500, onError: 'fail' },
            },
            {
              id: 'out',
              type: 'result',
              value: { ok: { $literal: true } },
            },
          ],
        },
      },
    };

    const compiled = compileOperation(
      graph,
      { entities: {} },
      { projections: {}, relations: {} },
      {
        registry,
        serviceName: 'orders',
        ownedAggregates: new Set(),
        exposure: 'read',
      },
    );
    expect(compiled.ok, compiled.ok ? '' : JSON.stringify(compiled.errors, null, 2)).toBe(true);
    if (!compiled.ok) return;

    const calls: unknown[] = [];
    const callClient: OperationCallClient = {
      async call(input) {
        calls.push(input);
        if (input.target.id === 'service:files.getDownloadUrl') {
          return { ok: true, value: { presigned: { url: 'https://files.example/resume.pdf' } } };
        }
        return { ok: true, value: { content: [] } };
      },
    };

    await executeOperation(
      compiled.value,
      { fileId: 'file-1', filename: 'resume.pdf' },
      {
        qsmDb: openSqliteDatabase({ filename: ':memory:' }),
        eventStore: null,
        callClient,
        now: () => '2026-05-06T00:00:00.000Z',
        nextId: () => 'id',
        actor: null,
        correlation: { commandId: 'cmd', correlationId: 'corr', traceparent: null },
        idempotencyKey: null,
      },
    );

    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({
      payload: {
        request: {
          context: { idempotency_key: 'idem-1' },
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 4,
                  file: {
                    filename: 'resume.pdf',
                    url: 'https://files.example/resume.pdf',
                  },
                },
              ],
            },
          ],
        },
      },
    });
  });
});
