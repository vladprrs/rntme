import errorCodesJson from '../error-codes.json' with { type: 'json' };

export interface MarketingSiteErrorCodes {
  validate: readonly string[];
  provision: readonly string[];
}

export const errorCodes: MarketingSiteErrorCodes = errorCodesJson as MarketingSiteErrorCodes;

export const allErrorCodes: readonly string[] = [...errorCodes.validate, ...errorCodes.provision];

export type MarketingSiteErrorCode = (typeof allErrorCodes)[number];
