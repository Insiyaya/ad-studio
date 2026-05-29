/**
 * Local filesystem storage implementation.
 *
 * Files are written under `env.storage.localPath` and served by the Express
 * static middleware at `/storage/*`. The key is used as the relative path
 * within that directory.
 *
 * In production (Oracle Cloud), this is replaced by the Oracle Object Storage
 * implementation. The swap is transparent to all callers.
 */

import fs from 'fs/promises';
import path from 'path';
import type { StorageService, StoredObject } from './interface';

export class LocalStorageService implements StorageService {
  private readonly basePath: string;

  /**
   * @param basePath Absolute path to the storage root directory.
   *   Created on first write if it doesn't exist.
   */
  constructor(basePath: string) {
    this.basePath = path.resolve(basePath);
  }

  async save(key: string, data: Buffer, contentType: string): Promise<StoredObject> {
    const filePath = path.join(this.basePath, key);
    // Ensure the full directory tree exists before writing
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    const stat = await fs.stat(filePath);

    return {
      key,
      url: this.getUrl(key),
      contentType,
      sizeBytes: stat.size,
      createdAt: Date.now(),
    };
  }

  getUrl(key: string): string {
    // Express serves the storage directory at /storage — matches static mount in index.ts
    return `/storage/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    const filePath = path.join(this.basePath, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    try {
      await fs.unlink(filePath);
    } catch (err: unknown) {
      // Treat ENOENT as a successful delete — idempotent behaviour
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }
}
