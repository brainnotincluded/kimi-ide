/**
 * useTrench hook - React hook for interacting with Trench CLI
 * Provides methods for search, research, code search, papers, and archive
 */

import { useState, useCallback, useEffect, useRef } from 'react';

const { ipcRenderer } = window.require('electron');

// Types matching main process
export type TrenchCommand = 'search' | 'research' | 'code' | 'papers' | 'archive';

export interface TrenchOptions {
  query: string;
  limit?: number;
  timeout?: number;
  outputFormat?: 'json' | 'markdown' | 'text';
  additionalArgs?: string[];
}

export interface TrenchResult {
  success: boolean;
  data?: any;
  error?: string;
  stdout?: string;
  stderr?: string;
}

export interface TrenchProgress {
  commandId: string;
  data: string;
}

export interface TrenchSearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

export interface TrenchCodeResult {
  file: string;
  line: number;
  content: string;
  repository?: string;
}

export interface TrenchPaperResult {
  title: string;
  authors: string[];
  year: number;
  url: string;
  abstract?: string;
}

/**
 * Hook for Trench CLI operations
 */
export function useTrench() {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const progressListeners = useRef<Set<(data: string) => void>>(new Set());

  // Check trench availability on mount
  useEffect(() => {
    checkAvailability();
  }, []);

  // Setup progress listener
  useEffect(() => {
    const handler = (_: any, update: TrenchProgress) => {
      setProgress(update.data);
      progressListeners.current.forEach(listener => listener(update.data));
    };

    ipcRenderer.on('trench:progress', handler);
    return () => {
      ipcRenderer.removeListener('trench:progress', handler);
    };
  }, []);

  /**
   * Check if Trench CLI is available
   */
  const checkAvailability = useCallback(async () => {
    try {
      const result = await ipcRenderer.invoke('trench:check');
      setIsAvailable(result.available);
      if (result.version) {
        setVersion(result.version);
      }
      return result;
    } catch (error) {
      setIsAvailable(false);
      return { available: false, error: (error as Error).message };
    }
  }, []);

  /**
   * Execute a Trench search
   */
  const search = useCallback(async (options: TrenchOptions): Promise<TrenchResult> => {
    setIsLoading(true);
    setProgress('');
    try {
      const result = await ipcRenderer.invoke('trench:search', options);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Execute deep research
   */
  const research = useCallback(async (options: TrenchOptions): Promise<TrenchResult> => {
    setIsLoading(true);
    setProgress('');
    try {
      const result = await ipcRenderer.invoke('trench:research', options);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Search code
   */
  const code = useCallback(async (options: TrenchOptions): Promise<TrenchResult> => {
    setIsLoading(true);
    setProgress('');
    try {
      const result = await ipcRenderer.invoke('trench:code', options);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Search academic papers
   */
  const papers = useCallback(async (options: TrenchOptions): Promise<TrenchResult> => {
    setIsLoading(true);
    setProgress('');
    try {
      const result = await ipcRenderer.invoke('trench:papers', options);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Archive a website
   */
  const archive = useCallback(async (options: TrenchOptions): Promise<TrenchResult> => {
    setIsLoading(true);
    setProgress('');
    try {
      const result = await ipcRenderer.invoke('trench:archive', options);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Cancel an active command
   */
  const cancel = useCallback(async (commandId: string): Promise<boolean> => {
    return ipcRenderer.invoke('trench:cancel', commandId);
  }, []);

  /**
   * Subscribe to progress updates
   */
  const onProgress = useCallback((callback: (data: string) => void) => {
    progressListeners.current.add(callback);
    return () => {
      progressListeners.current.delete(callback);
    };
  }, []);

  /**
   * Parse search results from output
   */
  const parseSearchResults = useCallback((result: TrenchResult): TrenchSearchResult[] => {
    if (!result.success || !result.data) return [];

    try {
      if (typeof result.data === 'object' && result.data.results) {
        return result.data.results;
      }
      
      // Try to parse from raw output
      const raw = result.stdout || result.data.raw || '';
      const lines = raw.split('\n').filter(l => l.trim());
      const results: TrenchSearchResult[] = [];
      
      let current: Partial<TrenchSearchResult> = {};
      for (const line of lines) {
        if (line.startsWith('Title:')) {
          if (current.title) results.push(current as TrenchSearchResult);
          current = { title: line.replace('Title:', '').trim() };
        } else if (line.startsWith('URL:')) {
          current.url = line.replace('URL:', '').trim();
        } else if (line.startsWith('Snippet:')) {
          current.snippet = line.replace('Snippet:', '').trim();
        }
      }
      if (current.title) results.push(current as TrenchSearchResult);
      
      return results;
    } catch {
      return [];
    }
  }, []);

  /**
   * Parse code search results
   */
  const parseCodeResults = useCallback((result: TrenchResult): TrenchCodeResult[] => {
    if (!result.success || !result.data) return [];

    try {
      if (typeof result.data === 'object' && result.data.results) {
        return result.data.results;
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  /**
   * Parse paper search results
   */
  const parsePaperResults = useCallback((result: TrenchResult): TrenchPaperResult[] => {
    if (!result.success || !result.data) return [];

    try {
      if (typeof result.data === 'object' && result.data.results) {
        return result.data.results;
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  return {
    // State
    isAvailable,
    isLoading,
    version,
    progress,
    
    // Actions
    search,
    research,
    code,
    papers,
    archive,
    cancel,
    checkAvailability,
    onProgress,
    
    // Parsers
    parseSearchResults,
    parseCodeResults,
    parsePaperResults
  };
}
