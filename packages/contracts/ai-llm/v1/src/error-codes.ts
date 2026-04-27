import errorCodesJson from '../error-codes.json' with { type: 'json' };

export const errorCodes = errorCodesJson as {
  structural: readonly string[];
  references: readonly string[];
  consistency: readonly string[];
  vendor: readonly string[];
};

export type ErrorLayer = keyof typeof errorCodes;

export type ErrorCode =
  | (typeof errorCodes.structural)[number]
  | (typeof errorCodes.references)[number]
  | (typeof errorCodes.consistency)[number]
  | (typeof errorCodes.vendor)[number];

const ALL_CODES = new Set<string>([
  ...errorCodesJson.structural,
  ...errorCodesJson.references,
  ...errorCodesJson.consistency,
  ...errorCodesJson.vendor,
]);

export function isErrorCode(value: string): value is ErrorCode {
  return ALL_CODES.has(value);
}

export function layerOf(code: ErrorCode): ErrorLayer {
  if ((errorCodesJson.structural as readonly string[]).includes(code)) return 'structural';
  if ((errorCodesJson.references as readonly string[]).includes(code)) return 'references';
  if ((errorCodesJson.consistency as readonly string[]).includes(code)) return 'consistency';
  return 'vendor';
}
