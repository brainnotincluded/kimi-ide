/**
 * Search Manager - High-level search management with debouncing
 * Coordinates between UI and search workers
 */

import { EventEmitter } from 'events';
import { SearchWorker } from './SearchWorker';
import {
  SearchOptions,
  ReplaceOptions,
  SearchResult,
  SearchStats,
  SearchEvent,
  SearchProgress,
} from './types';
import { debounce, DebouncedSearchOptions, DEFAULT_DEBOUNCED_SEARCH_OPTIONS } from './utils';

export interface SearchState {
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Current search query */
  query: string;
  /** Current search options */
  options: SearchOptions;
  /** Search results */
  results: SearchResult[];
  /** Search statistics */
  stats?: SearchStats;
  /** Search progress */
  progress?: SearchProgress;
  /** Error message if any */
  error?: string;
}

export class SearchManager extends EventEmitter {
  private worker: SearchWorker;
  private state: SearchState;
  private debouncedSearch: ReturnType<typeof debounce>;
  private debounceOptions: Required<DebouncedSearchOptions>;

  constructor(
    projectRoot: string,
    debounceOptions: DebouncedSearchOptions = {}
  ) {
    super();
    
    this.worker = new SearchWorker(projectRoot);
    this.debounceOptions = {
      ...DEFAULT_DEBOUNCED_SEARCH_OPTIONS,
      ...debounceOptions,
    };

    this.state = {
      isSearching: false,
      query: '',
      options: {
        query: '',
        caseSensitive: false,
        wholeWord: false,
        regex: false,
      },
      results: [],
    };

    // Create debounced search function
    this.debouncedSearch = debounce(
      this.performSearch.bind(this),
      this.debounceOptions.delay
    );
  }

  /**
   * Get current search state
   */
  getState(): SearchState {
    return { ...this.state };
  }

  /**
   * Update search query (debounced)
   */
  search(query: string, options?: Partial<SearchOptions>): void {
    // Validate query length
    if (query.length < this.debounceOptions.minQueryLength) {
      this.clearResults();
      return;
    }

    if (query.length > this.debounceOptions.maxQueryLength) {
      query = query.substring(0, this.debounceOptions.maxQueryLength);
    }

    // Update state
    this.state.query = query;
    this.state.options = {
      ...this.state.options,
      ...options,
      query,
    };

    // Cancel any pending search
    this.cancel();
    this.state.isSearching = true;
    this.state.error = undefined;
    this.state.results = [];

    // Emit state change
    this.emit('stateChange', this.getState());

    // Trigger debounced search
    this.debouncedSearch();
  }

  /**
   * Search immediately without debounce
   */
  searchImmediate(query: string, options?: Partial<SearchOptions>): Promise<SearchStats> {
    this.debouncedSearch.cancel();
    
    this.state.query = query;
    this.state.options = {
      ...this.state.options,
      ...options,
      query,
    };

    return this.performSearch();
  }

  /**
   * Perform the actual search
   */
  private async performSearch(): Promise<SearchStats> {
    this.state.isSearching = true;
    this.state.results = [];
    this.emit('stateChange', this.getState());

    try {
      const stats = await this.worker.search(this.state.options, (event) => {
        this.handleSearchEvent(event);
      });

      this.state.stats = stats;
      this.state.isSearching = false;
      this.emit('stateChange', this.getState());
      this.emit('complete', stats);

      return stats;
    } catch (error) {
      this.state.isSearching = false;
      this.state.error = error instanceof Error ? error.message : String(error);
      this.emit('stateChange', this.getState());
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Handle search events from worker
   */
  private handleSearchEvent(event: SearchEvent): void {
    switch (event.type) {
      case 'result':
        const result = event.data as SearchResult;
        // Check if we already have results for this file
        const existingIndex = this.state.results.findIndex(r => r.file === result.file);
        if (existingIndex >= 0) {
          this.state.results[existingIndex] = result;
        } else {
          this.state.results.push(result);
        }
        this.emit('result', result);
        this.emit('stateChange', this.getState());
        break;

      case 'progress':
        this.state.progress = event.data as SearchProgress;
        this.emit('progress', this.state.progress);
        this.emit('stateChange', this.getState());
        break;

      case 'error':
        this.state.error = event.data instanceof Error ? event.data.message : String(event.data);
        this.emit('error', event.data);
        this.emit('stateChange', this.getState());
        break;

      case 'cancelled':
        this.state.isSearching = false;
        this.emit('cancelled');
        this.emit('stateChange', this.getState());
        break;

      case 'complete':
        this.state.stats = event.data as SearchStats;
        break;
    }
  }

  /**
   * Cancel current search
   */
  cancel(): void {
    this.debouncedSearch.cancel();
    this.worker.cancel();
  }

  /**
   * Clear all results
   */
  clearResults(): void {
    this.cancel();
    this.state = {
      isSearching: false,
      query: '',
      options: this.state.options,
      results: [],
      stats: undefined,
      progress: undefined,
      error: undefined,
    };
    this.emit('stateChange', this.getState());
  }

  /**
   * Replace all matches
   */
  async replace(replacement: string, preserveCase?: boolean): Promise<{ replacedFiles: number; replacedMatches: number }> {
    const replaceOptions: ReplaceOptions = {
      ...this.state.options,
      replacement,
      preserveCase,
    };

    this.emit('replaceStart');

    try {
      const result = await this.worker.replace(replaceOptions);
      this.emit('replaceComplete', result);
      
      // Refresh search after replace
      if (this.state.query) {
        this.searchImmediate(this.state.query, this.state.options);
      }
      
      return result;
    } catch (error) {
      this.emit('replaceError', error);
      throw error;
    }
  }

  /**
   * Search in a specific file
   */
  async searchInFile(filePath: string, query?: string): Promise<import('./types').SearchMatch[]> {
    const searchQuery = query || this.state.query;
    if (!searchQuery) return [];

    return this.worker.searchInFile(filePath, searchQuery, {
      caseSensitive: this.state.options.caseSensitive,
      wholeWord: this.state.options.wholeWord,
      regex: this.state.options.regex,
    });
  }

  /**
   * Update search options
   */
  updateOptions(options: Partial<SearchOptions>): void {
    this.state.options = { ...this.state.options, ...options };
    
    // Re-trigger search if we have a query
    if (this.state.query.length >= this.debounceOptions.minQueryLength) {
      this.search(this.state.query);
    }
  }

  /**
   * Set include patterns
   */
  setIncludePatterns(patterns: string[]): void {
    this.updateOptions({ include: patterns });
  }

  /**
   * Set exclude patterns
   */
  setExcludePatterns(patterns: string[]): void {
    this.updateOptions({ exclude: patterns });
  }

  /**
   * Toggle case sensitivity
   */
  toggleCaseSensitive(): void {
    this.updateOptions({ caseSensitive: !this.state.options.caseSensitive });
  }

  /**
   * Toggle whole word
   */
  toggleWholeWord(): void {
    this.updateOptions({ wholeWord: !this.state.options.wholeWord });
  }

  /**
   * Toggle regex
   */
  toggleRegex(): void {
    this.updateOptions({ regex: !this.state.options.regex });
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.cancel();
    this.debouncedSearch.cancel();
    this.worker.terminate();
    this.removeAllListeners();
  }
}
