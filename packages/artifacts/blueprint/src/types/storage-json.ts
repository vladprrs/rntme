declare const validatedStorageJsonBrand: unique symbol;

export interface RouteOwner {
  readonly aggregate: string;
  readonly association: string;
}

export interface RouteAuth {
  readonly requireRole: readonly string[] | null;
}

export interface RouteLifecycle {
  /** Pending uploads not committed within this duration -> FileUploadAborted. ms. */
  readonly expirePendingMs: number;
  /** null = keep forever; otherwise duration in ms. */
  readonly retainCommittedMs: number | null;
}

export interface StorageRoute {
  readonly id: string;
  readonly owner: RouteOwner;
  /** Bytes. */
  readonly maxSize: number;
  readonly allowedTypes: readonly string[];
  readonly maxCount: number | null;
  readonly auth: RouteAuth;
  readonly lifecycle: RouteLifecycle;
}

export interface StorageJson {
  readonly version: '1.0';
  readonly routes: Record<string, StorageRoute>;
}

export type ValidatedStorageJson = StorageJson & {
  readonly [validatedStorageJsonBrand]: true;
};

/** INTERNAL: only the validator pipeline brands an instance. */
export function brandStorageJson(value: StorageJson): ValidatedStorageJson {
  return value as ValidatedStorageJson;
}
