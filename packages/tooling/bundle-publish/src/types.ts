export type PublishTarget = {
  kind: 's3';
  bucket: string;
  endpoint?: string;
  region?: string;
};

export type S3Reference = {
  bucket: string;
  key: string;
  sha256: string;
  endpoint?: string;
  region?: string;
};

export type PublishOptions = {
  keyPrefix?: string;
  maxBytes?: number;
  ignore?: string[];
};

export type PublishResult = {
  ref: S3Reference;
  bytes: number;
  durationMs: number;
};

export type PublishErrorCode =
  | 'BUNDLE_PUBLISH_FOLDER_MISSING'
  | 'BUNDLE_PUBLISH_TOO_LARGE'
  | 'BUNDLE_PUBLISH_NO_INDEX_HTML'
  | 'BUNDLE_PUBLISH_S3_CREDS_MISSING'
  | 'BUNDLE_PUBLISH_S3_PUT_FAILED';

export type PublishError = {
  code: PublishErrorCode;
  message: string;
  cause?: unknown;
};
