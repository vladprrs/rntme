import { describe, expect, it } from 'bun:test';
import { runtimeModuleOperationEffect } from '../../src/start/runtime-module-operations.js';

describe('runtimeModuleOperationEffect', () => {
  it('classifies identity-auth0 IntrospectSession as a read', () => {
    expect(runtimeModuleOperationEffect('identity-auth0', 'IntrospectSession')).toBe('read');
  });

  it('classifies openrouter Complete as an action', () => {
    expect(runtimeModuleOperationEffect('openrouter', 'Complete')).toBe('action');
  });

  it('classifies storage GetDownloadUrl as a read', () => {
    expect(runtimeModuleOperationEffect('storage', 'GetDownloadUrl')).toBe('read');
  });

  it('classifies storage upload commands as actions', () => {
    for (const operation of ['PrepareUpload', 'CommitUpload', 'AbortUpload', 'DeleteFile']) {
      expect(runtimeModuleOperationEffect('storage', operation)).toBe('action');
    }
  });

  it('classifies storage read RPCs as reads', () => {
    for (const operation of ['GetFile', 'ListFiles']) {
      expect(runtimeModuleOperationEffect('storage', operation)).toBe('read');
    }
  });

  it('returns null for unknown module/operation pairs', () => {
    expect(runtimeModuleOperationEffect('identity-auth0', 'CreateUser')).toBeNull();
    expect(runtimeModuleOperationEffect('openrouter', 'Unknown')).toBeNull();
    expect(runtimeModuleOperationEffect('storage', 'Unknown')).toBeNull();
    expect(runtimeModuleOperationEffect('marketing', 'AnyOp')).toBeNull();
  });
});
