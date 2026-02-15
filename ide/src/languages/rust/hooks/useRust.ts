/**
 * React Hook for Rust Language Support
 * Provides convenient access to Rust tooling in React components
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RustToolchainInfo,
  RustInstallationCheck,
  CargoResult,
  RustDiagnostic,
  RustConfiguration,
} from '../types';
import * as rust from '../renderer-api';

interface UseRustOptions {
  workspaceRoot: string;
  autoCheck?: boolean;
  checkInterval?: number;
}

interface UseRustReturn {
  // State
  installed: boolean | null;
  toolchainInfo: RustToolchainInfo | null;
  isRustProject: boolean;
  projectName: string | null;
  config: RustConfiguration | null;
  diagnostics: RustDiagnostic[];
  isLoading: boolean;
  
  // Actions
  checkInstallation: () => Promise<void>;
  refreshToolchainInfo: () => Promise<void>;
  build: (release?: boolean) => Promise<CargoResult>;
  test: () => Promise<CargoResult>;
  run: () => Promise<CargoResult>;
  check: () => Promise<void>;
  updateConfig: (updates: Partial<RustConfiguration>) => Promise<void>;
  
  // Status
  isBuilding: boolean;
  isTesting: boolean;
  isRunning: boolean;
  isChecking: boolean;
}

export function useRust(options: UseRustOptions): UseRustReturn {
  const { workspaceRoot, autoCheck = false, checkInterval = 30000 } = options;
  
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [toolchainInfo, setToolchainInfo] = useState<RustToolchainInfo | null>(null);
  const [isRustProject, setIsRustProject] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [config, setConfig] = useState<RustConfiguration | null>(null);
  const [diagnostics, setDiagnostics] = useState<RustDiagnostic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isBuilding, setIsBuilding] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check installation
  const checkInstallation = useCallback(async () => {
    setIsLoading(true);
    try {
      const check = await rust.checkRustInstallation();
      setInstalled(check.installed);
      
      if (check.installed) {
        const info = await rust.getToolchainInfo();
        setToolchainInfo(info);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh toolchain info
  const refreshToolchainInfo = useCallback(async () => {
    const info = await rust.getToolchainInfo();
    setToolchainInfo(info);
  }, []);

  // Load project info
  const loadProjectInfo = useCallback(async () => {
    if (!workspaceRoot) return;
    
    try {
      const info = await rust.getProjectInfo(workspaceRoot);
      setIsRustProject(info.isRustProject);
      setProjectName(info.projectName);
      
      if (info.isRustProject) {
        const cfg = await rust.getConfig(workspaceRoot);
        setConfig(cfg);
      }
    } catch (error) {
      console.error('Failed to load project info:', error);
    }
  }, [workspaceRoot]);

  // Build project
  const build = useCallback(async (release = false): Promise<CargoResult> => {
    setIsBuilding(true);
    try {
      return await rust.build(workspaceRoot, release);
    } finally {
      setIsBuilding(false);
    }
  }, [workspaceRoot]);

  // Test project
  const test = useCallback(async (): Promise<CargoResult> => {
    setIsTesting(true);
    try {
      return await rust.test(workspaceRoot);
    } finally {
      setIsTesting(false);
    }
  }, [workspaceRoot]);

  // Run project
  const run = useCallback(async (): Promise<CargoResult> => {
    setIsRunning(true);
    try {
      return await rust.run(workspaceRoot);
    } finally {
      setIsRunning(false);
    }
  }, [workspaceRoot]);

  // Check code
  const check = useCallback(async () => {
    setIsChecking(true);
    try {
      const diags = await rust.check(workspaceRoot);
      setDiagnostics(diags);
    } finally {
      setIsChecking(false);
    }
  }, [workspaceRoot]);

  // Update config
  const updateConfig = useCallback(async (updates: Partial<RustConfiguration>) => {
    if (!workspaceRoot) return;
    
    const newConfig = await rust.updateConfig(workspaceRoot, updates);
    setConfig(newConfig);
  }, [workspaceRoot]);

  // Initial load
  useEffect(() => {
    checkInstallation();
    loadProjectInfo();
  }, [checkInstallation, loadProjectInfo]);

  // Auto check
  useEffect(() => {
    if (autoCheck && isRustProject) {
      check();
      
      intervalRef.current = setInterval(() => {
        check();
      }, checkInterval);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoCheck, isRustProject, checkInterval, check]);

  return {
    installed,
    toolchainInfo,
    isRustProject,
    projectName,
    config,
    diagnostics,
    isLoading,
    checkInstallation,
    refreshToolchainInfo,
    build,
    test,
    run,
    check,
    updateConfig,
    isBuilding,
    isTesting,
    isRunning,
    isChecking,
  };
}

export default useRust;
