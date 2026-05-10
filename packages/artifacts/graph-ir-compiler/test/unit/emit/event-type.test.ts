import { describe, it, expect } from 'bun:test';
import { deriveEventTypeName } from '../../../src/emit/event-type.js';

describe('deriveEventTypeName', () => {
  it('PascalCases entity + transition (matches @rntme/pdm deriveEventTypes)', () => {
    expect(deriveEventTypeName('Issue', 'assign')).toBe('IssueAssign');
    expect(deriveEventTypeName('Issue', 'report')).toBe('IssueReport');
    expect(deriveEventTypeName('Issue', 'reassign')).toBe('IssueReassign');
  });
});
