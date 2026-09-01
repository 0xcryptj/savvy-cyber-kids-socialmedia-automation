/**
 * The two shapes of state this app keeps: JSON documents and binary blobs.
 *
 * Everything under storage/ is one or the other, so a backend only has to
 * implement these two interfaces. The file backend below is what runs locally;
 * a libsql backend for documents and a blob-host backend for media drop in
 * behind the same calls when this moves off a machine with a writable disk.
 */
export type DocumentKey =
  | "workspace"
  | "postiz-exports"
  | "postiz-settings"
  | "source-cache"
  | "credentials"
  | "settings"
  | "pipeline"
  | "auth";

export interface DocumentStore {
  read<T>(key: DocumentKey): Promise<T | undefined>;
  write<T>(key: DocumentKey, value: T): Promise<void>;
  /**
   * Read, change, write - without another caller's write landing in between.
   *
   * Every document here is updated that way, and doing it as three separate
   * steps loses writes as soon as two requests overlap. Callers should reach
   * for this rather than read/write by hand.
   */
  update<T>(key: DocumentKey, mutate: (current: T | undefined) => T): Promise<T>;
}

export interface BlobStore {
  read(key: string): Promise<Uint8Array<ArrayBuffer> | undefined>;
  write(key: string, bytes: Uint8Array, contentType?: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Documents holding credentials, written with restricted permissions by
 * backends that have a filesystem to restrict.
 */
export const secretDocuments = new Set<DocumentKey>(["credentials", "postiz-settings"]);
