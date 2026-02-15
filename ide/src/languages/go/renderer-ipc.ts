/**
 * Go Language Renderer IPC
 * 
 * Renderer process API for Go language support
 * Used by React components to communicate with main process
 */

import { ipcRenderer } from 'electron';
import {
  GoInstallation,
  GoModule,
  GoCommandResult,
  GoDiagnostic,
  GoCompletionItem,
  GoBuildResult,
  GoTestResult,
  GoToolsStatus,
  GoConfiguration,
  GoEnvInfo
} from './types';

/**
 * Go Language API for renderer process
 */
export const go = {
  /**
   * Check Go installation and environment
   */
  checkInstallation: async (): Promise<GoInstallation> => {
    return ipcRenderer.invoke('go:checkInstallation');
  },

  /**
   * Get Go tools status
   */
  getToolsStatus: async (): Promise<GoToolsStatus> => {
    return ipcRenderer.invoke('go:getToolsStatus');
  },

  /**
   * Get module information from go.mod
   */
  getModulesInfo: async (modPath?: string): Promise<GoModule | null> => {
    return ipcRenderer.invoke('go:getModulesInfo', modPath);
  },

  /**
   * Run a Go command
   */
  runCommand: async (command: string, args: string[] = []): Promise<GoCommandResult> => {
    return ipcRenderer.invoke('go:runCommand', command, args);
  },

  /**
   * Build the project
   */
  build: async (filePath?: string, outputPath?: string): Promise<GoBuildResult> => {
    return ipcRenderer.invoke('go:build', filePath, outputPath);
  },

  /**
   * Run tests
   */
  test: async (pattern?: string, filePath?: string): Promise<GoTestResult> => {
    return ipcRenderer.invoke('go:test', pattern, filePath);
  },

  /**
   * Format code in a file
   */
  format: async (filePath: string): Promise<string> => {
    return ipcRenderer.invoke('go:format', filePath);
  },

  /**
   * Format code content
   */
  formatContent: async (content: string): Promise<string> => {
    return ipcRenderer.invoke('go:formatContent', content);
  },

  /**
   * Get diagnostics for project or file
   */
  getDiagnostics: async (filePath?: string): Promise<GoDiagnostic[]> => {
    return ipcRenderer.invoke('go:getDiagnostics', filePath);
  },

  /**
   * Run go mod tidy
   */
  modTidy: async (): Promise<GoCommandResult> => {
    return ipcRenderer.invoke('go:modTidy');
  },

  /**
   * Download modules
   */
  modDownload: async (): Promise<GoCommandResult> => {
    return ipcRenderer.invoke('go:modDownload');
  },

  /**
   * Get code completions
   */
  getCompletions: async (filePath: string, line: number, column: number): Promise<GoCompletionItem[]> => {
    return ipcRenderer.invoke('go:getCompletions', filePath, line, column);
  },

  /**
   * Initialize gopls
   */
  initializeGopls: async (): Promise<boolean> => {
    return ipcRenderer.invoke('go:initializeGopls');
  },

  /**
   * Shutdown gopls
   */
  shutdownGopls: async (): Promise<void> => {
    return ipcRenderer.invoke('go:shutdownGopls');
  },

  /**
   * Update Go configuration
   */
  updateConfig: async (config: Partial<GoConfiguration>): Promise<GoConfiguration> => {
    return ipcRenderer.invoke('go:updateConfig', config);
  },

  /**
   * Get current configuration
   */
  getConfig: async (): Promise<GoConfiguration> => {
    return ipcRenderer.invoke('go:getConfig');
  },

  /**
   * Install Go tools
   */
  installTools: async (tools: string[]): Promise<Record<string, boolean>> => {
    return ipcRenderer.invoke('go:installTools', tools);
  },

  /**
   * Get Go environment info
   */
  getEnvInfo: async (): Promise<Record<string, string>> => {
    return ipcRenderer.invoke('go:getEnvInfo');
  }
};

// Expose to window for use in components
if (typeof window !== 'undefined') {
  (window as any).go = go;
}

export default go;
