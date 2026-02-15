/**
 * useOutline Hook
 * React hook for outline functionality
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  DocumentSymbol,
  WorkspaceSymbol,
  Position,
  OutlineOptions,
  NavigationTarget,
  BreadcrumbItem,
} from './types';
import { OutlineProvider } from './OutlineProvider';

interface UseOutlineOptions {
  /** Outline provider instance */
  provider?: OutlineProvider;
  /** Initial URI */
  initialUri?: string;
  /** Initial options */
  initialOptions?: OutlineOptions;
  /** Callback when navigation occurs */
  onNavigate?: (target: NavigationTarget) => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
  /** Auto refresh interval (ms, 0 to disable) */
  autoRefreshInterval?: number;
}

interface UseOutlineReturn {
  /** Current document symbols */
  symbols: DocumentSymbol[];
  /** Workspace symbols */
  workspaceSymbols: WorkspaceSymbol[];
  /** Breadcrumbs for current position */
  breadcrumbs: BreadcrumbItem[];
  /** Current options */
  options: OutlineOptions;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Current URI */
  currentUri: string | undefined;
  /** Current cursor position */
  cursorPosition: Position | undefined;
  /** Refresh symbols for current file */
  refresh: () => Promise<void>;
  /** Load symbols for a file */
  loadFile: (uri: string, content: string) => Promise<void>;
  /** Search workspace symbols */
  searchWorkspace: (query: string) => Promise<void>;
  /** Update cursor position */
  setCursorPosition: (position: Position) => void;
  /** Navigate to symbol */
  navigateToSymbol: (symbol: DocumentSymbol) => void;
  /** Update options */
  updateOptions: (options: Partial<OutlineOptions>) => void;
  /** Clear error */
  clearError: () => void;
}

/**
 * React hook for outline functionality
 */
export function useOutline(options: UseOutlineOptions = {}): UseOutlineReturn {
  const {
    provider: customProvider,
    initialUri,
    initialOptions,
    onNavigate,
    onError,
    autoRefreshInterval = 0,
  } = options;

  // Provider instance
  const provider = useMemo(() => customProvider || new OutlineProvider(), [customProvider]);

  // State
  const [symbols, setSymbols] = useState<DocumentSymbol[]>([]);
  const [workspaceSymbols, setWorkspaceSymbols] = useState<WorkspaceSymbol[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [outlineOptions, setOutlineOptions] = useState<OutlineOptions>({
    sort: { by: 'position', direction: 'asc' },
    filter: {},
    followCursor: true,
    expandLevel: 0,
    showBreadcrumbs: true,
    groupByType: false,
    ...initialOptions,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUri, setCurrentUri] = useState<string | undefined>(initialUri);
  const [cursorPosition, setCursorPositionState] = useState<Position | undefined>();

  // Refs for async operations
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Load symbols for a file
   */
  const loadFile = useCallback(async (uri: string, content: string) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setError(null);
    setCurrentUri(uri);

    try {
      const newSymbols = await provider.getDocumentSymbols(uri, content);
      
      // Check if request was aborted
      if (abortControllerRef.current.signal.aborted) {
        return;
      }

      setSymbols(newSymbols);
      
      // Update breadcrumbs if we have a cursor position
      if (cursorPosition) {
        const breadcrumbSymbols = await provider.getBreadcrumbs(uri, cursorPosition);
        setBreadcrumbs(
          breadcrumbSymbols.map(s => ({
            name: s.name,
            kind: s.kind,
            range: s.range,
          }))
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load symbols';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, [provider, cursorPosition, onError]);

  /**
   * Refresh current file
   */
  const refresh = useCallback(async () => {
    if (!currentUri) {
      setError('No file is currently open');
      return;
    }

    // Invalidate cache and reload
    provider.invalidateCache(currentUri);
    
    // Note: content needs to be fetched from the editor/document model
    // This is a placeholder - actual implementation would get content from editor
    setError('Refresh requires file content. Use loadFile() instead.');
  }, [currentUri, provider]);

  /**
   * Search workspace symbols
   */
  const searchWorkspace = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Get workspace path - this would come from your app state
      const workspacePath = ''; // Placeholder
      const results = await provider.getWorkspaceSymbols(query, workspacePath);
      setWorkspaceSymbols(results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search workspace';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, [provider, onError]);

  /**
   * Update cursor position and breadcrumbs
   */
  const setCursorPosition = useCallback(async (position: Position) => {
    setCursorPositionState(position);

    if (!currentUri || !outlineOptions.followCursor) {
      return;
    }

    try {
      const breadcrumbSymbols = await provider.getBreadcrumbs(currentUri, position);
      setBreadcrumbs(
        breadcrumbSymbols.map(s => ({
          name: s.name,
          kind: s.kind,
          range: s.range,
        }))
      );
    } catch (err) {
      console.warn('Failed to update breadcrumbs:', err);
    }
  }, [currentUri, outlineOptions.followCursor, provider]);

  /**
   * Navigate to a symbol
   */
  const navigateToSymbol = useCallback((symbol: DocumentSymbol) => {
    if (!currentUri || !symbol.range) {
      return;
    }

    const target: NavigationTarget = {
      uri: currentUri,
      range: symbol.selectionRange || symbol.range,
    };

    onNavigate?.(target);
  }, [currentUri, onNavigate]);

  /**
   * Update outline options
   */
  const updateOptions = useCallback((newOptions: Partial<OutlineOptions>) => {
    setOutlineOptions(prev => ({ ...prev, ...newOptions }));
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Auto refresh
   */
  useEffect(() => {
    if (autoRefreshInterval <= 0 || !currentUri) {
      return;
    }

    const intervalId = setInterval(() => {
      refresh();
    }, autoRefreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, currentUri, refresh]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    symbols,
    workspaceSymbols,
    breadcrumbs,
    options: outlineOptions,
    isLoading,
    error,
    currentUri,
    cursorPosition,
    refresh,
    loadFile,
    searchWorkspace,
    setCursorPosition,
    navigateToSymbol,
    updateOptions,
    clearError,
  };
}

export default useOutline;
