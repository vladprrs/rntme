import errorCodesJson from '../error-codes.json' with { type: 'json' };

export type CrmErrorLayer = 'structural' | 'references' | 'consistency' | 'vendor';

export interface CrmErrorCodes {
  structural: readonly string[];
  references: readonly string[];
  consistency: readonly string[];
  vendor: readonly string[];
}

export const errorCodes: CrmErrorCodes = errorCodesJson as CrmErrorCodes;

export const allErrorCodes: readonly string[] = [
  ...errorCodesJson.structural,
  ...errorCodesJson.references,
  ...errorCodesJson.consistency,
  ...errorCodesJson.vendor,
];

export type CrmErrorCode = (typeof allErrorCodes)[number];

export function isErrorCode(value: string): value is CrmErrorCode {
  return allErrorCodes.includes(value);
}

export function layerOf(code: CrmErrorCode): CrmErrorLayer {
  return code.split('_')[1]?.toLowerCase() as CrmErrorLayer;
}
