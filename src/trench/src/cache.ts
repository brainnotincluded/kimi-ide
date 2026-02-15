/**
 * Trench CLI - Cache Management
 * SQLite-based caching with TTL support
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { Database } from 'better-sqlite3';
import type { CacheEntry, CacheStats } from './types/index.js';

interface CacheRow {
  key: string;
  data: string;
  created_at: number;
  expires_at: number;
  hit_count: number;
}

/**
 * Cache manager with SQLite backend
 */
export class CacheManager {
  private db: Database | null = null;
  private dbPath: string;
  private defaultTtl: number;
  private maxSize: number;
  private enabled: boolean;
  private compression: boolean;

  constructor(options: {
    dbPath: string;
    defaultTtl: number;
    maxSize: number;
    enabled?: boolean;
    compression?: boolean;
  }) {
    this.dbPath = options.dbPath;
    this.defaultTtl = options.defaultTtl;
    this.maxSize = options.maxSize;
    this.enabled = options.enabled ?? true;
    this.compression = options.compression ?? true;
  }

  /**
   * Initialize the cache database
   */
  async init(): Promise<void> {
    if (!this.enabled) return;

    // Ensure cache directory exists
    const dir = path.dirname(this.dbPath);
    await fs.mkdir(dir, { recursive: true });

    // Open database
    const sqlite3 = await import('better-sqlite3');
    this.db = new sqlite3.default(this.dbPath);

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        data BLOB NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        hit_count INTEGER DEFAULT 0,
        size INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_expires ON cache(expires_at);
      CREATE INDEX IF NOT EXISTS idx_created ON cache(created_at);
    `);

    // Clean up expired entries on startup
    this.cleanup();
  }

  /**
   * Generate cache key from input
   */
  generateKey(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): CacheEntry<T> | null {
    if (!this.enabled || !this.db) return null;

    const now = Date.now();
    
    try {
      const row = this.db.prepare<CacheRow, [number, string]>(
        'SELECT * FROM cache WHERE key = ? AND expires_at > ?'
      ).get(now, key);

      if (!row) return null;

      // Update hit count
      this.db.prepare('UPDATE cache SET hit_count = hit_count + 1 WHERE key = ?').run(key);

      // Decompress and parse data
      const data = this.decompress(Buffer.from(row.data, 'base64'));
      
      return {
        data: JSON.parse(data) as T,
        createdAt: new Date(row.created_at),
        expiresAt: new Date(row.expires_at),
        key: row.key,
        hitCount: row.hit_count + 1,
      };
    } catch (error) {
      console.warn('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    if (!this.enabled || !this.db) return;

    const effectiveTtl = ttl ?? this.defaultTtl;
    const now = Date.now();
    const expiresAt = now + (effectiveTtl * 1000);

    try {
      // Serialize and compress data
      const serialized = JSON.stringify(data);
      const compressed = this.compress(serialized);
      const base64Data = compressed.toString('base64');

      // Check if we'd exceed max size
      this.enforceSizeLimit();

      // Insert or replace
      this.db.prepare(`
        INSERT OR REPLACE INTO cache (key, data, created_at, expires_at, size)
        VALUES (?, ?, ?, ?, ?)
      `).run(key, base64Data, now, expiresAt, base64Data.length);
    } catch (error) {
      console.warn('Cache set error:', error);
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    if (!this.enabled || !this.db) return false;

    const now = Date.now();
    const result = this.db.prepare<[number], [number, string]>(
      'SELECT 1 FROM cache WHERE key = ? AND expires_at > ?'
    ).get(now, key);

    return !!result;
  }

  /**
   * Delete key from cache
   */
  delete(key: string): boolean {
    if (!this.enabled || !this.db) return false;

    const result = this.db.prepare('DELETE FROM cache WHERE key = ?').run(key);
    return result.changes > 0;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    if (!this.enabled || !this.db) return;

    this.db.exec('DELETE FROM cache');
    this.db.exec('VACUUM');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    if (!this.enabled || !this.db) {
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        missRate: 0,
      };
    }

    const totalEntries = this.db.prepare<[number], []>('SELECT COUNT(*) as count FROM cache').get() as { count: number };
    const totalSize = this.db.prepare<[number], []>('SELECT COALESCE(SUM(size), 0) as size FROM cache').get() as { size: number };
    const totalHits = this.db.prepare<[number], []>('SELECT COALESCE(SUM(hit_count), 0) as hits FROM cache').get() as { hits: number };

    // Calculate hit rate (simplified - in production, track gets vs hits)
    const hitRate = totalEntries.count > 0 
      ? (totalHits.hits / (totalEntries.count + totalHits.hits)) * 100 
      : 0;

    return {
      totalEntries: totalEntries.count,
      totalSize: totalSize.size,
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round((100 - hitRate) * 100) / 100,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    if (!this.enabled || !this.db) return 0;

    const now = Date.now();
    const result = this.db.prepare<number, [number]>(
      'DELETE FROM cache WHERE expires_at <= ?'
    ).run(now);

    if (result.changes > 0) {
      this.db.exec('VACUUM');
    }

    return result.changes;
  }

  /**
   * Enforce size limit by removing oldest entries
   */
  private enforceSizeLimit(): void {
    if (!this.db) return;

    const currentSize = this.db.prepare<[number], []>('SELECT COALESCE(SUM(size), 0) as size FROM cache').get() as { size: number };
    
    if (currentSize.size > this.maxSize) {
      // Remove oldest 10% of entries
      const toRemove = Math.ceil(this.getStats().totalEntries * 0.1);
      
      this.db.prepare<number, [number]>(`
        DELETE FROM cache WHERE key IN (
          SELECT key FROM cache ORDER BY created_at ASC LIMIT ?
        )
      `).run(toRemove);
      
      this.db.exec('VACUUM');
    }
  }

  /**
   * Compress data
   */
  private compress(data: string): Buffer {
    if (!this.compression) {
      return Buffer.from(data, 'utf-8');
    }
    return require('zlib').gzipSync(Buffer.from(data, 'utf-8'));
  }

  /**
   * Decompress data
   */
  private decompress(data: Buffer): string {
    if (!this.compression) {
      return data.toString('utf-8');
    }
    try {
      return require('zlib').gunzipSync(data).toString('utf-8');
    } catch {
      // Data might not be compressed
      return data.toString('utf-8');
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Get cache entry with fallback
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try cache first
    const cached = this.get<T>(key);
    if (cached) {
      return cached.data;
    }

    // Generate value
    const value = await factory();
    
    // Store in cache
    this.set(key, value, ttl);
    
    return value;
  }

  /**
   * Get multiple values from cache
   */
  getMany<T>(keys: string[]): Map<string, CacheEntry<T>> {
    const results = new Map<string, CacheEntry<T>>();
    
    for (const key of keys) {
      const entry = this.get<T>(key);
      if (entry) {
        results.set(key, entry);
      }
    }
    
    return results;
  }

  /**
   * Set multiple values in cache
   */
  setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): void {
    for (const entry of entries) {
      this.set(entry.key, entry.value, entry.ttl);
    }
  }

  /**
   * Get cache keys matching pattern
   */
  keys(pattern?: string): string[] {
    if (!this.enabled || !this.db) return [];

    if (pattern) {
      return this.db.prepare<string[], [string]>(
        'SELECT key FROM cache WHERE key LIKE ?'
      ).all(`%${pattern}%`).map((row: { key: string }) => row.key);
    }

    return this.db.prepare<string[], []>('SELECT key FROM cache').all().map((row: { key: string }) => row.key);
  }
}

/**
 * Disk cache for downloaded files
 */
export class DiskCache {
  private baseDir: string;
  private enabled: boolean;

  constructor(baseDir: string, enabled: boolean = true) {
    this.baseDir = baseDir;
    this.enabled = enabled;
  }

  /**
   * Initialize disk cache
   */
  async init(): Promise<void> {
    if (!this.enabled) return;
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  /**
   * Get file path for URL
   */
  getFilePath(url: string, ext?: string): string {
    const hash = crypto.createHash('sha256').update(url).digest('hex');
    const extension = ext || path.extname(new URL(url).pathname) || '.bin';
    return path.join(this.baseDir, `${hash}${extension}`);
  }

  /**
   * Check if file exists in cache
   */
  async exists(url: string): Promise<boolean> {
    if (!this.enabled) return false;
    
    try {
      const filePath = this.getFilePath(url);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file from cache
   */
  async get(url: string): Promise<Buffer | null> {
    if (!this.enabled) return null;
    
    try {
      const filePath = this.getFilePath(url);
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  /**
   * Save file to cache
   */
  async set(url: string, data: Buffer, ext?: string): Promise<string> {
    if (!this.enabled) return url;
    
    const filePath = this.getFilePath(url, ext);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    
    return filePath;
  }

  /**
   * Get file info
   */
  async getInfo(url: string): Promise<{ size: number; modified: Date } | null> {
    if (!this.enabled) return null;
    
    try {
      const filePath = this.getFilePath(url);
      const stats = await fs.stat(filePath);
      
      return {
        size: stats.size,
        modified: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  /**
   * Clear disk cache
   */
  async clear(): Promise<void> {
    if (!this.enabled) return;
    
    try {
      await fs.rm(this.baseDir, { recursive: true });
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to clear disk cache:', error);
    }
  }

  /**
   * Get cache size
   */
  async getSize(): Promise<number> {
    if (!this.enabled) return 0;
    
    try {
      const files = await fs.readdir(this.baseDir, { recursive: true });
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(this.baseDir, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
        }
      }
      
      return totalSize;
    } catch {
      return 0;
    }
  }
}

// Singleton instances
let globalCacheManager: CacheManager | null = null;
let globalDiskCache: DiskCache | null = null;

/**
 * Get global cache manager
 */
export function getCacheManager(): CacheManager | null {
  return globalCacheManager;
}

/**
 * Initialize global cache
 */
export async function initCache(options: {
  dbPath: string;
  defaultTtl: number;
  maxSize: number;
  enabled?: boolean;
  compression?: boolean;
}): Promise<CacheManager> {
  globalCacheManager = new CacheManager(options);
  await globalCacheManager.init();
  return globalCacheManager;
}

/**
 * Initialize global disk cache
 */
export async function initDiskCache(baseDir: string, enabled?: boolean): Promise<DiskCache> {
  globalDiskCache = new DiskCache(baseDir, enabled);
  await globalDiskCache.init();
  return globalDiskCache;
}
