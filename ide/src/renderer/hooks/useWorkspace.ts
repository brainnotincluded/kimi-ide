/**
 * @fileoverview Workspace management hook
 * @module renderer/hooks/useWorkspace
 */

import { useState, useCallback, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

export interface UseWorkspaceReturn {
  workspace: string | null;
  isLoading: boolean;
  error: string | null;
  openFolder: () => Promise<void>;
  setWorkspace: (path: string | null) => void;
}

export function useWorkspace(): UseWorkspaceReturn {
  const [workspace, setWorkspaceState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openFolder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await ipcRenderer.invoke('dialog:openFolder');
      if (result) {
        setWorkspaceState(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open folder');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setWorkspace = useCallback((path: string | null) => {
    setWorkspaceState(path);
    setError(null);
  }, []);

  // Listen for folder opened events from main process
  useEffect(() => {
    const handleFolderOpened = (_: any, folderPath: string) => {
      setWorkspaceState(folderPath);
    };

    ipcRenderer.on('folder:opened', handleFolderOpened);

    return () => {
      ipcRenderer.off('folder:opened', handleFolderOpened);
    };
  }, []);

  return {
    workspace,
    isLoading,
    error,
    openFolder,
    setWorkspace,
  };
}

export default useWorkspace;
