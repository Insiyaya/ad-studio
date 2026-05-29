/**
 * Storage service abstraction.
 *
 * WHY an interface here: the local implementation uses Node.js fs — Oracle
 * Object Storage uses the OCI SDK. Callers (crawl runner, media service) never
 * import either implementation directly; they get the active service through
 * the factory in index.ts. Swapping local → Oracle is a one-line env var change.
 */

export interface StoredObject {
  /** Relative key used to retrieve or construct the URL, e.g. `projects/abc/cover.jpg` */
  key: string;
  /** Public-accessible URL for this object */
  url: string;
  contentType: string;
  sizeBytes: number;
  createdAt: number;
}

export interface StorageService {
  /**
   * Persists a binary buffer under the given key.
   * Creates any intermediate directories as needed.
   * Key convention: `{namespace}/{subpath}/{filename}` e.g. `projects/abc123/voiceover.mp3`
   */
  save(key: string, data: Buffer, contentType: string): Promise<StoredObject>;

  /**
   * Returns a publicly accessible URL for the given key.
   * For local storage: a path served by Express static middleware.
   * For Oracle Object Storage: a pre-authenticated request (PAR) URL.
   */
  getUrl(key: string): string;

  /** Returns true if an object with this key exists */
  exists(key: string): Promise<boolean>;

  /** Removes the object. No-ops silently if the key doesn't exist. */
  delete(key: string): Promise<void>;
}
