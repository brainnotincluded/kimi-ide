/**
 * Utility functions for Trench Archival Browser
 */

import { createHash } from 'crypto';
import { URL } from 'url';
import path from 'path';
import sanitizeFilename from 'sanitize-filename';
import type { AssetType } from './types.js';

/**
 * Generate SHA-256 hash of data
 */
export function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a short ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Get file extension from URL or MIME type
 */
export function getFileExtension(url: string, mimeType?: string): string {
  // Try to get extension from URL first
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (ext && ext.length > 1 && ext.length < 6) {
      return ext.slice(1);
    }
  } catch {
    // Invalid URL, continue to MIME type check
  }

  // Map MIME types to extensions
  if (mimeType) {
    const mimeToExt: Record<string, string> = {
      'text/html': 'html',
      'text/css': 'css',
      'text/javascript': 'js',
      'application/javascript': 'js',
      'application/json': 'json',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/svg+xml': 'svg',
      'image/webp': 'webp',
      'image/avif': 'avif',
      'font/woff2': 'woff2',
      'font/woff': 'woff',
      'font/ttf': 'ttf',
      'font/otf': 'otf',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/ogg': 'ogv',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/webm': 'weba',
      'application/wasm': 'wasm',
      'text/plain': 'txt',
      'application/xml': 'xml',
      'application/pdf': 'pdf',
      'application/zip': 'zip',
    };

    const ext = mimeToExt[mimeType.toLowerCase()];
    if (ext) return ext;
  }

  return 'bin';
}

/**
 * Determine asset type from MIME type and resource type
 */
export function getAssetType(mimeType: string, resourceType?: string): AssetType {
  const mime = mimeType.toLowerCase();
  
  if (mime.includes('text/html') || resourceType === 'document') return 'document';
  if (mime.includes('text/css') || resourceType === 'stylesheet') return 'stylesheet';
  if (mime.includes('javascript') || resourceType === 'script') return 'script';
  if (mime.includes('image/') || resourceType === 'image') return 'image';
  if (mime.includes('font/') || mime.includes('font-')) return 'font';
  if (mime.includes('video/') || resourceType === 'media' || mime.includes('application/vnd.apple.mpegurl')) return 'video';
  if (mime.includes('audio/')) return 'audio';
  if (mime.includes('application/wasm')) return 'wasm';
  if (resourceType === 'xhr' || resourceType === 'fetch') return 'xhr';
  if (resourceType === 'websocket') return 'websocket';
  if (resourceType === 'worker' || resourceType === 'service_worker') return 'worker';
  
  return 'other';
}

/**
 * Check if URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a relative URL against a base URL
 */
export function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

/**
 * Get domain from URL
 */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Check if URL is internal (same domain)
 */
export function isInternalUrl(baseUrl: string, targetUrl: string): boolean {
  try {
    const baseDomain = getDomain(baseUrl);
    const targetDomain = getDomain(targetUrl);
    return baseDomain === targetDomain;
  } catch {
    return false;
  }
}

/**
 * Sanitize filename for filesystem
 */
export function safeFilename(name: string): string {
  // Remove protocol and special characters
  let sanitized = name
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9\-\._]/g, '_')
    .substring(0, 100);
  
  return sanitizeFilename(sanitized) || 'unnamed';
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await sleep(delay * Math.pow(2, i));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Create a deferred promise
 */
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  return { promise, resolve, reject };
}

/**
 * Parse headers from CDP response
 */
export function parseHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    // CDP returns headers in lowercase, normalize them
    result[key.toLowerCase()] = value;
  }
  return result;
}

/**
 * Check if content type is text
 */
export function isTextContent(mimeType: string): boolean {
  const textTypes = [
    'text/',
    'application/json',
    'application/xml',
    'application/javascript',
    'application/ecmascript',
  ];
  return textTypes.some(type => mimeType.toLowerCase().includes(type));
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Get content type from file path
 */
export function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.wasm': 'application/wasm',
    '.xml': 'application/xml',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Normalize URL (remove fragments, normalize slashes)
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.hash = ''; // Remove fragment
    urlObj.search = urlObj.search; // Keep query string
    return urlObj.href;
  } catch {
    return url;
  }
}

/**
 * Extract links from HTML content
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  const srcRegex = /src=["']([^"']+)["']/gi;
  const urlRegex = /url\(["']?([^"')]+)["']?\)/gi;
  
  let match;
  
  // Extract href attributes
  while ((match = hrefRegex.exec(html)) !== null) {
    try {
      links.push(new URL(match[1], baseUrl).href);
    } catch {
      // Invalid URL, skip
    }
  }
  
  // Extract src attributes
  while ((match = srcRegex.exec(html)) !== null) {
    try {
      links.push(new URL(match[1], baseUrl).href);
    } catch {
      // Invalid URL, skip
    }
  }
  
  // Extract url() in CSS
  while ((match = urlRegex.exec(html)) !== null) {
    try {
      links.push(new URL(match[1], baseUrl).href);
    } catch {
      // Invalid URL, skip
    }
  }
  
  return [...new Set(links)];
}

/**
 * Rate limiter for controlling request frequency
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private lastRequestTime = 0;
  
  constructor(
    private minInterval: number,
    private maxConcurrent: number,
    private currentConcurrent = 0
  ) {}
  
  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }
  
  release(): void {
    this.currentConcurrent--;
    this.processQueue();
  }
  
  private processQueue(): void {
    if (this.queue.length === 0) return;
    if (this.currentConcurrent >= this.maxConcurrent) return;
    
    const now = Date.now();
    const timeToWait = Math.max(0, this.minInterval - (now - this.lastRequestTime));
    
    if (timeToWait === 0) {
      const next = this.queue.shift();
      if (next) {
        this.currentConcurrent++;
        this.lastRequestTime = Date.now();
        next();
      }
    } else {
      setTimeout(() => this.processQueue(), timeToWait);
    }
  }
}
