import { describe, expect, it } from 'bun:test';
import { CLI_ERROR_CODES } from '../../../src/errors/codes.js';

describe('direct-mode error codes', () => {
  it('exposes target-file, secret-missing, blueprint, bundle, and teardown codes', () => {
    expect(CLI_ERROR_CODES).toContain('CLI_DEPLOY_TARGET_FILE_INVALID');
    expect(CLI_ERROR_CODES).toContain('CLI_DEPLOY_SECRET_MISSING');
    expect(CLI_ERROR_CODES).toContain('CLI_DEPLOY_BLUEPRINT_INVALID');
    expect(CLI_ERROR_CODES).toContain('CLI_DEPLOY_PLATFORM_BLUEPRINT_NOT_BUNDLED');
    expect(CLI_ERROR_CODES).toContain('CLI_DEPLOY_TEARDOWN_FAILED');
  });
});
