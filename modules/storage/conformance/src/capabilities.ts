export const STORAGE_CANONICAL_RPCS = [
  'PrepareUpload',
  'CommitUpload',
  'AbortUpload',
  'GetFile',
  'ListFiles',
  'GetDownloadUrl',
  'DeleteFile',
] as const;

export const STORAGE_CANONICAL_EVENTS = [
  'FileUploadInitiated',
  'FileUploadCommitted',
  'FileUploadAborted',
  'FileOrphaned',
  'FileDeleted',
  'FileLifecycleSwept',
] as const;

export const STORAGE_S3_COMPATIBLE_BACKENDS = [
  'aws-s3',
  'cloudflare-r2',
  'minio',
  'rustfs',
  'digitalocean-spaces',
  'backblaze-b2',
  'tigris',
] as const;

export const STORAGE_CAPABILITY_FIELDS = [
  'vendors',
  's3_compatible_backends',
  'rpcs',
  'events',
  'max_object_size_bytes',
  'presign_ttl_default_sec',
  'supports_multipart',
] as const;
