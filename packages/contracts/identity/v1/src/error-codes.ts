import errorCodesJson from '../error-codes.json' with { type: 'json' };

export type IdentityErrorLayer = 'structural' | 'references' | 'consistency' | 'vendor';

export interface IdentityErrorCodes {
  structural: readonly string[];
  references: readonly string[];
  consistency: readonly string[];
  vendor: readonly string[];
}

export const errorCodes: IdentityErrorCodes = errorCodesJson as IdentityErrorCodes;

export const allErrorCodes: readonly string[] = [
  ...errorCodesJson.structural,
  ...errorCodesJson.references,
  ...errorCodesJson.consistency,
  ...errorCodesJson.vendor,
];

export type IdentityErrorCode = (typeof allErrorCodes)[number];
