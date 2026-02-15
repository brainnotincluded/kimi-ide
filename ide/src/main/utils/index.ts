/**
 * @fileoverview Main process utilities
 * @module main/utils
 */

import * as path from 'path';

/**
 * Validates a file path
 */
export function isValidPath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }
  // Add additional path validation if needed
  return true;
}

/**
 * Normalizes a file path
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath);
}

/**
 * Checks if a path is within a directory
 */
export function isPathWithin(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Formats an error message
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Debounce for main process
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
