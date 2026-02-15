/**
 * Trench CLI - Cache Utilities
 */

import { CacheManager } from '../cache';

/**
 * Global cache manager instance
 */
let cacheManager: CacheManager | null = null;

/**
 * Set global cache manager
 */
export function setCacheManager(manager: CacheManager): void {
  cacheManager = manager;
}

/**
 * Get global cache manager
 */
export function getCacheManager(): CacheManager | null {
  return cacheManager;
}
