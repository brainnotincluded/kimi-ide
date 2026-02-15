/**
 * Search utilities - Debounce and other helper functions
 */

/**
 * Debounce function - delays execution until after wait milliseconds
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate: boolean = false
): {
  (...args: Parameters<T>): void;
  cancel(): void;
  flush(): void;
} {
  let timeout: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: any;

  const later = () => {
    timeout = null;
    if (!immediate && lastArgs) {
      func.apply(lastThis, lastArgs);
      lastArgs = null;
      lastThis = null;
    }
  };

  const debounced = function (this: any, ...args: Parameters<T>) {
    lastArgs = args;
    lastThis = this;

    const callNow = immediate && !timeout;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);

    if (callNow) {
      func.apply(this, args);
      lastArgs = null;
      lastThis = null;
    }
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    lastArgs = null;
    lastThis = null;
  };

  debounced.flush = () => {
    if (timeout) {
      clearTimeout(timeout);
      later();
    }
  };

  return debounced;
}

/**
 * Throttle function - executes at most once per wait milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): {
  (...args: Parameters<T>): void;
  cancel(): void;
} {
  let timeout: NodeJS.Timeout | null = null;
  let previous = 0;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: any;

  const throttled = function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = wait - (now - previous);

    lastArgs = args;
    lastThis = this;

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func.apply(this, args);
      lastArgs = null;
      lastThis = null;
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now();
        timeout = null;
        if (lastArgs) {
          func.apply(lastThis, lastArgs);
          lastArgs = null;
          lastThis = null;
        }
      }, remaining);
    }
  };

  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    lastArgs = null;
    lastThis = null;
    previous = 0;
  };

  return throttled;
}

/**
 * Escape special regex characters
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Format search duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Highlight matches in text
 */
export function highlightMatches(
  text: string,
  query: string,
  options: { caseSensitive?: boolean; regex?: boolean; wholeWord?: boolean } = {}
): string {
  let pattern = options.regex ? query : escapeRegExp(query);
  
  if (options.wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }

  const flags = options.caseSensitive ? 'g' : 'gi';
  
  try {
    const regex = new RegExp(`(${pattern})`, flags);
    return text.replace(regex, '<mark>$1</mark>');
  } catch {
    return text;
  }
}

/**
 * Get context lines around a match
 */
export function getContextLines(
  lines: string[],
  matchLine: number,
  contextLines: number = 2
): { before: string[]; after: string[] } {
  const start = Math.max(0, matchLine - contextLines - 1);
  const end = Math.min(lines.length, matchLine + contextLines);

  return {
    before: lines.slice(start, matchLine - 1),
    after: lines.slice(matchLine, end),
  };
}

/**
 * Simple glob to regex converter for basic patterns
 */
export function globToRegex(pattern: string): RegExp {
  let regex = pattern
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  // Handle braces {a,b,c}
  regex = regex.replace(/\{([^}]+)\}/g, (match, content) => {
    return `(${content.split(',').map((s: string) => s.trim()).join('|')})`;
  });

  return new RegExp(`^${regex}$`);
}

/**
 * Check if file should be excluded based on patterns
 */
export function shouldExcludeFile(
  filePath: string,
  excludePatterns: string[]
): boolean {
  for (const pattern of excludePatterns) {
    const regex = globToRegex(pattern);
    if (regex.test(filePath)) {
      return true;
    }
  }
  return false;
}

/**
 * Debounced search options interface
 */
export interface DebouncedSearchOptions {
  /** Debounce delay in milliseconds */
  delay?: number;
  /** Minimum query length to trigger search */
  minQueryLength?: number;
  /** Maximum query length */
  maxQueryLength?: number;
}

/**
 * Default debounced search options
 */
export const DEFAULT_DEBOUNCED_SEARCH_OPTIONS: Required<DebouncedSearchOptions> = {
  delay: 300,
  minQueryLength: 2,
  maxQueryLength: 1000,
};
