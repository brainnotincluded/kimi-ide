/**
 * React Hooks for Web Language Support
 * Provides easy integration with React components
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  Diagnostic,
  CompletionItem,
  TextEdit,
  Position,
  NPMScript,
  DependencyInfo,
  WebLanguageStatus,
  RunScriptResult,
  InstallPackagesResult,
} from '../types';

// Type for the web API (would be injected by Electron)
interface WebLanguageAPI {
  // Lifecycle
  initialize: () => Promise<{ success: boolean; error?: string }>;
  dispose: () => Promise<void>;

  // TypeScript/JavaScript
  getDiagnostics: (filePath: string, content?: string) => Promise<Diagnostic[]>;
  format: (request: { file: string; content: string }) => Promise<{ success: boolean; formatted?: string; edits?: TextEdit[]; error?: string }>;
  lint: (request: { file: string; content?: string; fix?: boolean }) => Promise<{ success: boolean; diagnostics: Diagnostic[]; fixed?: boolean; error?: string }>;
  getCompletions: (filePath: string, position: Position, content?: string) => Promise<CompletionItem[]>;
  organizeImports: (filePath: string, content: string) => Promise<TextEdit[]>;
  renameSymbol: (params: { file: string; position: Position; newName: string }) => Promise<unknown>;
  extractFunction: (params: { file: string; range: { start: Position; end: Position }; functionName: string }) => Promise<unknown>;

  // Package Management
  installPackages: (request: { packages: string[]; dev?: boolean }) => Promise<InstallPackagesResult>;
  uninstallPackages: (packages: string[]) => Promise<{ success: string[]; failed: string[] }>;
  runScript: (request: { script: string; args?: string[] }) => Promise<RunScriptResult>;
  getScripts: () => Promise<NPMScript[]>;
  addScript: (name: string, command: string, description?: string) => Promise<boolean>;
  removeScript: (name: string) => Promise<boolean>;

  // Dependencies
  getDependencies: () => Promise<DependencyInfo[]>;
  checkOutdated: () => Promise<void>;
  updatePackage: (name: string) => Promise<boolean>;

  // Status
  getStatus: () => Promise<WebLanguageStatus>;

  // Events
  onScriptStarted: (callback: (data: { script: string }) => void) => () => void;
  onScriptFinished: (callback: (data: { script: string; exitCode: number }) => void) => () => void;
  onScriptOutput: (callback: (data: { script: string; type: 'stdout' | 'stderr'; data: string }) => void) => () => void;
  onInstalling: (callback: (data: { package: string }) => void) => () => void;
  onInstalled: (callback: (data: { package: string; success: boolean }) => void) => () => void;
  onCheckingOutdated: (callback: () => void) => () => void;
  onCheckedOutdated: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    webLanguage?: WebLanguageAPI;
  }
}

// Get API from window
const getAPI = (): WebLanguageAPI => {
  if (!window.webLanguage) {
    throw new Error('Web Language API not available');
  }
  return window.webLanguage;
};

// ============ useWebLanguageStatus ============

export function useWebLanguageStatus() {
  const [status, setStatus] = useState<WebLanguageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const newStatus = await getAPI().getStatus();
      setStatus(newStatus);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { status, loading, error, refresh };
}

// ============ useDiagnostics ============

export function useDiagnostics(filePath: string, content?: string) {
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!filePath) return;

    try {
      setLoading(true);
      const result = await getAPI().getDiagnostics(filePath, content);
      setDiagnostics(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get diagnostics');
    } finally {
      setLoading(false);
    }
  }, [filePath, content]);

  useEffect(() => {
    check();
  }, [check]);

  return { diagnostics, loading, error, check };
}

// ============ useFormatting ============

export function useFormatting() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const format = useCallback(async (filePath: string, content: string): Promise<string | null> => {
    try {
      setLoading(true);
      const result = await getAPI().format({ file: filePath, content });
      return result.success ? result.formatted || null : null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Format failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { format, loading, error };
}

// ============ useCompletions ============

export function useCompletions(filePath: string) {
  const [completions, setCompletions] = useState<CompletionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const getCompletions = useCallback(async (position: Position, content?: string) => {
    try {
      setLoading(true);
      const result = await getAPI().getCompletions(filePath, position, content);
      setCompletions(result);
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  return { completions, loading, getCompletions };
}

// ============ useNPMScripts ============

export function useNPMScripts() {
  const [scripts, setScripts] = useState<NPMScript[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningScripts, setRunningScripts] = useState<Set<string>>(new Set());
  const [scriptOutput, setScriptOutput] = useState<Map<string, string>>(new Map());

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAPI().getScripts();
      setScripts(result);
    } finally {
      setLoading(false);
    }
  }, []);

  const runScript = useCallback(async (name: string, args?: string[]) => {
    setRunningScripts(prev => new Set(prev).add(name));
    setScriptOutput(prev => new Map(prev).set(name, ''));
    
    try {
      const result = await getAPI().runScript({ script: name, args });
      return result;
    } finally {
      setRunningScripts(prev => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  }, []);

  const addScript = useCallback(async (name: string, command: string, description?: string) => {
    const success = await getAPI().addScript(name, command, description);
    if (success) refresh();
    return success;
  }, [refresh]);

  const removeScript = useCallback(async (name: string) => {
    const success = await getAPI().removeScript(name);
    if (success) refresh();
    return success;
  }, [refresh]);

  useEffect(() => {
    refresh();

    // Subscribe to events
    const unsubStarted = getAPI().onScriptStarted(({ script }) => {
      setRunningScripts(prev => new Set(prev).add(script));
    });

    const unsubFinished = getAPI().onScriptFinished(({ script }) => {
      setRunningScripts(prev => {
        const next = new Set(prev);
        next.delete(script);
        return next;
      });
    });

    const unsubOutput = getAPI().onScriptOutput(({ script, type, data }) => {
      setScriptOutput(prev => {
        const next = new Map(prev);
        const current = next.get(script) || '';
        next.set(script, current + data);
        return next;
      });
    });

    return () => {
      unsubStarted();
      unsubFinished();
      unsubOutput();
    };
  }, [refresh]);

  return {
    scripts,
    loading,
    runningScripts,
    scriptOutput,
    refresh,
    runScript,
    addScript,
    removeScript,
  };
}

// ============ useDependencies ============

export function useDependencies() {
  const [dependencies, setDependencies] = useState<DependencyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingOutdated, setCheckingOutdated] = useState(false);
  const [installingPackages, setInstallingPackages] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAPI().getDependencies();
      setDependencies(result);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkOutdated = useCallback(async () => {
    setCheckingOutdated(true);
    try {
      await getAPI().checkOutdated();
      await refresh();
    } finally {
      setCheckingOutdated(false);
    }
  }, [refresh]);

  const install = useCallback(async (packages: string[], dev?: boolean) => {
    setInstallingPackages(prev => {
      const next = new Set(prev);
      packages.forEach(p => next.add(p));
      return next;
    });

    try {
      const result = await getAPI().installPackages({ packages, dev });
      await refresh();
      return result;
    } finally {
      setInstallingPackages(prev => {
        const next = new Set(prev);
        packages.forEach(p => next.delete(p));
        return next;
      });
    }
  }, [refresh]);

  const uninstall = useCallback(async (packages: string[]) => {
    const result = await getAPI().uninstallPackages(packages);
    await refresh();
    return result;
  }, [refresh]);

  const update = useCallback(async (name: string) => {
    const success = await getAPI().updatePackage(name);
    if (success) await refresh();
    return success;
  }, [refresh]);

  useEffect(() => {
    refresh();

    const unsubInstalling = getAPI().onInstalling(({ package: pkg }) => {
      setInstallingPackages(prev => new Set(prev).add(pkg));
    });

    const unsubInstalled = getAPI().onInstalled(({ package: pkg }) => {
      setInstallingPackages(prev => {
        const next = new Set(prev);
        next.delete(pkg);
        return next;
      });
    });

    const unsubChecking = getAPI().onCheckingOutdated(() => {
      setCheckingOutdated(true);
    });

    const unsubChecked = getAPI().onCheckedOutdated(() => {
      setCheckingOutdated(false);
    });

    return () => {
      unsubInstalling();
      unsubInstalled();
      unsubChecking();
      unsubChecked();
    };
  }, [refresh]);

  return {
    dependencies,
    loading,
    checkingOutdated,
    installingPackages,
    refresh,
    checkOutdated,
    install,
    uninstall,
    update,
  };
}

// ============ useLinting ============

export function useLinting() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lint = useCallback(async (filePath: string, content?: string, fix?: boolean): Promise<Diagnostic[]> => {
    try {
      setLoading(true);
      const result = await getAPI().lint({ file: filePath, content, fix });
      return result.diagnostics;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lint failed');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { lint, loading, error };
}

// ============ useImports ============

export function useImports() {
  const [loading, setLoading] = useState(false);

  const organizeImports = useCallback(async (filePath: string, content: string): Promise<TextEdit[]> => {
    try {
      setLoading(true);
      return await getAPI().organizeImports(filePath, content);
    } finally {
      setLoading(false);
    }
  }, []);

  return { organizeImports, loading };
}

// ============ useRefactoring ============

export function useRefactoring() {
  const [loading, setLoading] = useState(false);

  const renameSymbol = useCallback(async (filePath: string, position: Position, newName: string) => {
    try {
      setLoading(true);
      return await getAPI().renameSymbol({ file: filePath, position, newName });
    } finally {
      setLoading(false);
    }
  }, []);

  const extractFunction = useCallback(async (filePath: string, start: Position, end: Position, functionName: string) => {
    try {
      setLoading(true);
      return await getAPI().extractFunction({
        file: filePath,
        range: { start, end },
        functionName,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  return { renameSymbol, extractFunction, loading };
}
