export type JsonValue = string | number | boolean | null | undefined | JsonObject | JsonArray;
export type JsonObject = {
  [key: string]: JsonValue;
};
export type JsonArray = Array<JsonValue>;

export interface AmoCrmAuth {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  expires_at?: number;
}

export interface AmoCrmConfig {
  subdomain: string;
  auth: AmoCrmAuth;
}

export interface Paginated<T> {
  data: T[];
  totalCount?: number;
  total_count?: number;
}

export interface IdempotencyStore {
  get(key: string): Promise<boolean>;
  set(key: string, ttlMs: number): Promise<void>;
}
