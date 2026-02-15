/**
 * @fileoverview Shared utility functions
 * @module shared/utils
 */

import { LANGUAGE_MAP, FILE_TYPE_NAMES } from '../constants';

/**
 * Get file extension from path
 */
export function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  return lastDot > 0 ? filePath.slice(lastDot + 1).toLowerCase() : '';
}

/**
 * Get file name without extension
 */
export function getFileName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  const name = parts[parts.length - 1] || '';
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.slice(0, lastDot) : name;
}

/**
 * Get file name with extension
 */
export function getBaseName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || '';
}

/**
 * Get directory path from file path
 */
export function getDirectory(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSep >= 0 ? filePath.slice(0, lastSep) : '';
}

/**
 * Detect language from file extension
 */
export function detectLanguage(filePath: string): string {
  const ext = getFileExtension(filePath);
  return LANGUAGE_MAP[ext] || 'plaintext';
}

/**
 * Get human-readable file type name
 */
export function getFileTypeName(filePath: string, language?: string): string {
  if (language) {
    const languageNames: Record<string, string> = {
      typescript: 'TypeScript',
      javascript: 'JavaScript',
      python: 'Python',
      java: 'Java',
      cpp: 'C++',
      go: 'Go',
      rust: 'Rust',
    };
    if (languageNames[language]) {
      return languageNames[language];
    }
  }
  
  const ext = getFileExtension(filePath);
  return FILE_TYPE_NAMES[ext] || 'Plain Text';
}

/**
 * Format cursor position for display
 */
export function formatCursorPosition(line: number, column: number): string {
  return `Ln ${line}, Col ${column}`;
}

/**
 * Check if path should be excluded
 */
export function isExcludedPath(path: string, excludedPatterns: readonly string[]): boolean {
  const name = getBaseName(path);
  return excludedPatterns.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(name) || regex.test(path);
    }
    return name === pattern || path.includes(`/${pattern}/`) || path.includes(`\\${pattern}\\`);
  });
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Generate unique ID
 */
export function generateId(prefix = ''): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key] as T[Extract<keyof T, string>];
    }
  }
  
  return result;
}
