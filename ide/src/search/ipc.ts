/**
 * Search IPC - Inter-process communication for search functionality
 * Handles communication between main and renderer processes
 */

import { ipcMain, ipcRenderer, IpcMainInvokeEvent, IpcRendererEvent } from 'electron';
import { SearchManager } from './SearchManager';
import {
  SearchOptions,
  ReplaceOptions,
  SearchResult,
  SearchStats,
  SearchEvent,
  SearchProgress,
} from './types';

// IPC Channel names
export const SEARCH_CHANNELS = {
  // Renderer -> Main
  QUERY: 'search:query',
  REPLACE: 'search:replace',
  REPLACE_ALL: 'search:replaceAll',
  CANCEL: 'search:cancel',
  CLEAR: 'search:clear',
  UPDATE_OPTIONS: 'search:updateOptions',
  SEARCH_IN_FILE: 'search:searchInFile',
  
  // Main -> Renderer (events)
  RESULT: 'search:result',
  PROGRESS: 'search:progress',
  COMPLETE: 'search:complete',
  ERROR: 'search:error',
  CANCELLED: 'search:cancelled',
  STATE_CHANGE: 'search:stateChange',
  REPLACE_START: 'search:replaceStart',
  REPLACE_COMPLETE: 'search:replaceComplete',
  REPLACE_ERROR: 'search:replaceError',
} as const;

// Request/Response types
export interface SearchQueryRequest {
  query: string;
  options?: Partial<SearchOptions>;
  immediate?: boolean;
}

export interface SearchReplaceRequest {
  replacement: string;
  preserveCase?: boolean;
}

export interface SearchUpdateOptionsRequest {
  options: Partial<SearchOptions>;
}

export interface SearchInFileRequest {
  filePath: string;
  query?: string;
}

export interface SearchStateResponse {
  isSearching: boolean;
  query: string;
  options: SearchOptions;
  results: SearchResult[];
  stats?: SearchStats;
  progress?: SearchProgress;
  error?: string;
}

/**
 * Setup search IPC handlers in main process
 */
export function setupSearchIPC(searchManager: SearchManager): void {
  // Query
  ipcMain.handle(
    SEARCH_CHANNELS.QUERY,
    async (_event: IpcMainInvokeEvent, request: SearchQueryRequest) => {
      if (request.immediate) {
        return searchManager.searchImmediate(request.query, request.options);
      } else {
        searchManager.search(request.query, request.options);
        return searchManager.getState();
      }
    }
  );

  // Replace
  ipcMain.handle(
    SEARCH_CHANNELS.REPLACE,
    async (_event: IpcMainInvokeEvent, request: SearchReplaceRequest) => {
      return searchManager.replace(request.replacement, request.preserveCase);
    }
  );

  // Cancel
  ipcMain.handle(SEARCH_CHANNELS.CANCEL, () => {
    searchManager.cancel();
    return searchManager.getState();
  });

  // Clear
  ipcMain.handle(SEARCH_CHANNELS.CLEAR, () => {
    searchManager.clearResults();
    return searchManager.getState();
  });

  // Update options
  ipcMain.handle(
    SEARCH_CHANNELS.UPDATE_OPTIONS,
    (_event: IpcMainInvokeEvent, request: SearchUpdateOptionsRequest) => {
      searchManager.updateOptions(request.options);
      return searchManager.getState();
    }
  );

  // Search in file
  ipcMain.handle(
    SEARCH_CHANNELS.SEARCH_IN_FILE,
    async (_event: IpcMainInvokeEvent, request: SearchInFileRequest) => {
      return searchManager.searchInFile(request.filePath, request.query);
    }
  );

  // Forward events from SearchManager to renderer
  searchManager.on('result', (result: SearchResult) => {
    broadcastToRenderers(SEARCH_CHANNELS.RESULT, result);
  });

  searchManager.on('progress', (progress: SearchProgress) => {
    broadcastToRenderers(SEARCH_CHANNELS.PROGRESS, progress);
  });

  searchManager.on('complete', (stats: SearchStats) => {
    broadcastToRenderers(SEARCH_CHANNELS.COMPLETE, stats);
  });

  searchManager.on('error', (error: any) => {
    broadcastToRenderers(SEARCH_CHANNELS.ERROR, error?.message || String(error));
  });

  searchManager.on('cancelled', () => {
    broadcastToRenderers(SEARCH_CHANNELS.CANCELLED);
  });

  searchManager.on('stateChange', (state) => {
    broadcastToRenderers(SEARCH_CHANNELS.STATE_CHANGE, state);
  });

  searchManager.on('replaceStart', () => {
    broadcastToRenderers(SEARCH_CHANNELS.REPLACE_START);
  });

  searchManager.on('replaceComplete', (result: { replacedFiles: number; replacedMatches: number }) => {
    broadcastToRenderers(SEARCH_CHANNELS.REPLACE_COMPLETE, result);
  });

  searchManager.on('replaceError', (error: any) => {
    broadcastToRenderers(SEARCH_CHANNELS.REPLACE_ERROR, error?.message || String(error));
  });
}

/**
 * Broadcast to all renderer processes
 */
function broadcastToRenderers(channel: string, ...args: any[]): void {
  const { BrowserWindow } = require('electron');
  const windows = BrowserWindow.getAllWindows();
  
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, ...args);
    }
  }
}

/**
 * Search IPC client for renderer process
 */
export class SearchIPCClient {
  private listeners = new Map<string, Set<(event: IpcRendererEvent, ...args: any[]) => void>>();

  /**
   * Execute search query (debounced)
   */
  async query(query: string, options?: Partial<SearchOptions>): Promise<SearchStateResponse> {
    return ipcRenderer.invoke(SEARCH_CHANNELS.QUERY, { query, options } as SearchQueryRequest);
  }

  /**
   * Execute search query immediately (no debounce)
   */
  async queryImmediate(query: string, options?: Partial<SearchOptions>): Promise<SearchStats> {
    return ipcRenderer.invoke(SEARCH_CHANNELS.QUERY, { 
      query, 
      options, 
      immediate: true 
    } as SearchQueryRequest);
  }

  /**
   * Replace all matches
   */
  async replace(replacement: string, preserveCase?: boolean): Promise<{ replacedFiles: number; replacedMatches: number }> {
    return ipcRenderer.invoke(SEARCH_CHANNELS.REPLACE, { 
      replacement, 
      preserveCase 
    } as SearchReplaceRequest);
  }

  /**
   * Cancel current search
   */
  async cancel(): Promise<SearchStateResponse> {
    return ipcRenderer.invoke(SEARCH_CHANNELS.CANCEL);
  }

  /**
   * Clear search results
   */
  async clear(): Promise<SearchStateResponse> {
    return ipcRenderer.invoke(SEARCH_CHANNELS.CLEAR);
  }

  /**
   * Update search options
   */
  async updateOptions(options: Partial<SearchOptions>): Promise<SearchStateResponse> {
    return ipcRenderer.invoke(SEARCH_CHANNELS.UPDATE_OPTIONS, { options } as SearchUpdateOptionsRequest);
  }

  /**
   * Search in specific file
   */
  async searchInFile(filePath: string, query?: string): Promise<import('./types').SearchMatch[]> {
    return ipcRenderer.invoke(SEARCH_CHANNELS.SEARCH_IN_FILE, { filePath, query } as SearchInFileRequest);
  }

  /**
   * Listen to search events
   */
  onResult(callback: (result: SearchResult) => void): () => void {
    return this.addListener(SEARCH_CHANNELS.RESULT, (_event, result) => callback(result));
  }

  onProgress(callback: (progress: SearchProgress) => void): () => void {
    return this.addListener(SEARCH_CHANNELS.PROGRESS, (_event, progress) => callback(progress));
  }

  onComplete(callback: (stats: SearchStats) => void): () => void {
    return this.addListener(SEARCH_CHANNELS.COMPLETE, (_event, stats) => callback(stats));
  }

  onError(callback: (error: string) => void): () => void {
    return this.addListener(SEARCH_CHANNELS.ERROR, (_event, error) => callback(error));
  }

  onCancelled(callback: () => void): () => void {
    return this.addListener(SEARCH_CHANNELS.CANCELLED, () => callback());
  }

  onStateChange(callback: (state: SearchStateResponse) => void): () => void {
    return this.addListener(SEARCH_CHANNELS.STATE_CHANGE, (_event, state) => callback(state));
  }

  onReplaceStart(callback: () => void): () => void {
    return this.addListener(SEARCH_CHANNELS.REPLACE_START, () => callback());
  }

  onReplaceComplete(callback: (result: { replacedFiles: number; replacedMatches: number }) => void): () => void {
    return this.addListener(SEARCH_CHANNELS.REPLACE_COMPLETE, (_event, result) => callback(result));
  }

  onReplaceError(callback: (error: string) => void): () => void {
    return this.addListener(SEARCH_CHANNELS.REPLACE_ERROR, (_event, error) => callback(error));
  }

  /**
   * Add IPC listener with tracking
   */
  private addListener(
    channel: string, 
    callback: (event: IpcRendererEvent, ...args: any[]) => void
  ): () => void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    
    this.listeners.get(channel)!.add(callback);
    ipcRenderer.on(channel, callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(channel)?.delete(callback);
      ipcRenderer.off(channel, callback);
    };
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    for (const [channel, callbacks] of this.listeners) {
      for (const callback of callbacks) {
        ipcRenderer.off(channel, callback);
      }
    }
    this.listeners.clear();
  }
}

// Singleton instance for renderer process
let searchClient: SearchIPCClient | null = null;

/**
 * Get or create search IPC client (renderer only)
 */
export function getSearchClient(): SearchIPCClient {
  if (!searchClient) {
    searchClient = new SearchIPCClient();
  }
  return searchClient;
}

/**
 * Dispose search IPC client
 */
export function disposeSearchClient(): void {
  searchClient?.removeAllListeners();
  searchClient = null;
}
