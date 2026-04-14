import { describe, it, expect } from 'vitest';
import { parseBindingArtifact, validateBindings, isOk } from '@rntme/bindings';
import { bindingsArtifact, resolvers } from '../src/artifacts.js';

describe('bindings.json — command entries', () => {
  it('validates all bindings (query + command)', () => {
    const parsed = parseBindingArtifact(bindingsArtifact);
    if (!isOk(parsed)) throw new Error(JSON.stringify(parsed.errors, null, 2));
    const v = validateBindings(parsed.value, resolvers);
    if (!isOk(v)) throw new Error(JSON.stringify(v.errors, null, 2));
    const ids = Object.keys(v.value.resolved).sort();
    for (const required of [
      'reportIssue', 'submitIssue',
      'assignIssue', 'assignIssueWithGuard',
      'reassignIssue', 'resolveIssue', 'reopenIssue', 'closeIssue',
    ]) {
      expect(ids).toContain(required);
      expect(v.value.resolved[required]!.entry.kind).toBe('command');
      expect(v.value.resolved[required]!.entry.http.method).toBe('POST');
    }
  });
});
