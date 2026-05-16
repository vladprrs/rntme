import { describe, expect, it } from 'bun:test';
import { toFailureOutput, formatFailure } from '../../../src/output/format.js';
import { cliError } from '../../../src/errors/codes.js';

// F046 regression coverage: when a CliError carries an array of validator-shaped
// errors as `cause`, each must surface as a nested entry (human + JSON paths).
describe('toFailureOutput preserves nested validator errors via CliError.cause', () => {
  it('extracts code/message/path/layer from each cause entry', () => {
    const e = cliError(
      'CLI_VALIDATE_LOCAL_FAILED',
      '2 blueprint compose errors (first: BLUEPRINT_PROJECT_INVALID); see nested for details',
      undefined,
      [
        {
          layer: 'compose',
          code: 'BLUEPRINT_PROJECT_INVALID',
          message: 'modules[].package missing',
          path: 'project.json',
        },
        {
          layer: 'compose',
          code: 'BLUEPRINT_SERVICE_INVALID',
          message: 'pdm/state.json: missing initial state',
          path: 'services/app/pdm/state.json',
        },
      ],
    );

    const out = toFailureOutput(e);

    expect(out.code).toBe('CLI_VALIDATE_LOCAL_FAILED');
    expect(out.message).toContain('2 blueprint compose errors');
    expect(out.nested).toHaveLength(2);
    expect(out.nested?.[0]).toEqual({
      code: 'BLUEPRINT_PROJECT_INVALID',
      message: 'modules[].package missing',
      path: 'project.json',
      pkg: undefined,
      stage: 'compose',
    });
    expect(out.nested?.[1]?.code).toBe('BLUEPRINT_SERVICE_INVALID');
    expect(out.nested?.[1]?.path).toBe('services/app/pdm/state.json');
  });

  it('returns nested:undefined when cause is not a usable array', () => {
    const e = cliError('CLI_USAGE', 'bad flags', undefined, 'just a string');
    expect(toFailureOutput(e).nested).toBeUndefined();
  });

  it('JSON output round-trips the nested array', () => {
    const e = cliError(
      'CLI_DEPLOY_BLUEPRINT_INVALID',
      '1 error',
      undefined,
      [{ code: 'BLUEPRINT_X', message: 'm', path: 'a.json' }],
    );
    const rendered = formatFailure('json', toFailureOutput(e));
    const parsed = JSON.parse(rendered);
    expect(parsed.error.nested).toHaveLength(1);
    expect(parsed.error.nested[0]).toMatchObject({ code: 'BLUEPRINT_X', message: 'm', path: 'a.json' });
  });

  it('human output prints "Nested errors:" block with each entry', () => {
    const e = cliError(
      'CLI_DEPLOY_BLUEPRINT_INVALID',
      '2 errors',
      undefined,
      [
        { code: 'A', message: 'msg-a', path: 'p-a' },
        { code: 'B', message: 'msg-b' },
      ],
    );
    const rendered = formatFailure('human', toFailureOutput(e));
    expect(rendered).toContain('Nested errors:');
    expect(rendered).toContain('A');
    expect(rendered).toContain('msg-a');
    expect(rendered).toContain('p-a');
    expect(rendered).toContain('B');
    expect(rendered).toContain('msg-b');
  });
});
