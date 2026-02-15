/**
 * Search Module for Kimi IDE IDE
 * VS Code-like project-wide search functionality
 * 
 * Features:
 * - Fast search using ripgrep (if available) or Node.js fallback
 * - Worker threads for non-blocking search
 * - Debounced search input
 * - Replace functionality
 * - React UI components
 * - Electron IPC integration
 * 
 * @example
 * ```typescript
 * // Basic usage
 * import { SearchManager, getSearchClient } from './search';
 * 
 * // In main process
 * const searchManager = new SearchManager('/path/to/project');
 * searchManager.search('function', {
 *   caseSensitive: false,
 *   include: ['*.ts'],
 * });
 * 
 * // In renderer process
 * const client = getSearchClient();
 * await client.query('function', { include: ['*.ts'] });
 * ```
 */

// Types
export {
  SearchOptions,
  ReplaceOptions,
  SearchResult,
  SearchMatch,
  SearchProgress,
  SearchStats,
  SearchEvent,
  SearchEventType,
  SearchEventListener,
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MAX_RESULTS,
} from './types';

// Core search functionality
export { SearchProvider } from './SearchProvider';
export { SearchWorker } from './SearchWorker';
export { SearchManager, type SearchState } from './SearchManager';

// Utilities
export {
  debounce,
  throttle,
  escapeRegExp,
  formatFileSize,
  formatDuration,
  highlightMatches,
  getContextLines,
  globToRegex,
  shouldExcludeFile,
  type DebouncedSearchOptions,
  DEFAULT_DEBOUNCED_SEARCH_OPTIONS,
} from './utils';

// IPC (Electron)
export {
  setupSearchIPC,
  getSearchClient,
  disposeSearchClient,
  SearchIPCClient,
  SEARCH_CHANNELS,
  type SearchQueryRequest,
  type SearchReplaceRequest,
  type SearchUpdateOptionsRequest,
  type SearchInFileRequest,
  type SearchStateResponse,
} from './ipc';

// React Components
export {
  SearchPanel,
  ReplaceBox,
  SearchResultsList,
  SearchContainer,
  type SearchPanelProps,
  type ReplaceBoxProps,
  type SearchResultsListProps,
  type SearchContainerProps,
} from './components';

// Version
export const VERSION = '1.0.0';
