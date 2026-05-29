/**
 * Storage service factory.
 *
 * Returns the active StorageService implementation based on STORAGE_PROVIDER.
 * All callers import from here, never from the implementation files directly.
 */

import path from 'path';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { LocalStorageService } from './local';
import type { StorageService } from './interface';

export type { StorageService, StoredObject } from './interface';

function createStorageService(): StorageService {
  if (env.storage.provider === 'oracle') {
    // Oracle Object Storage implementation would be instantiated here.
    // Throw clearly rather than silently falling back, so misconfigured
    // production deployments fail loud at startup.
    throw new Error(
      'Oracle Object Storage provider is not yet implemented. ' +
      'Set STORAGE_PROVIDER=local or implement services/storage/oracle.ts.'
    );
  }

  const absolutePath = path.resolve(process.cwd(), env.storage.localPath);
  logger.info('Storage: using local filesystem', { path: absolutePath });
  return new LocalStorageService(absolutePath);
}

/** Singleton — initialised once at startup, injected into services that need it */
export const storageService: StorageService = createStorageService();
