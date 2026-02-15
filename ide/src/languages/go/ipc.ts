/**
 * Go Language IPC Handlers
 * 
 * Main process IPC handlers for Go language support
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { GoLanguageProvider } from './provider';
import { GoConfiguration } from './types';

let goProvider: GoLanguageProvider | null = null;

/**
 * Initialize Go language IPC handlers
 */
export function initGoIPCHandlers(projectRoot: string, config?: Partial<GoConfiguration>): void {
  // Create provider instance
  goProvider = new GoLanguageProvider(config);
  goProvider.setProjectRoot(projectRoot);

  // Check installation on init
  goProvider.checkGoInstallation();

  // Initialize gopls if enabled
  if (config?.enableGopls !== false) {
    goProvider.initializeGopls();
  }

  // Register IPC handlers
  registerHandlers();
}

/**
 * Register all IPC handlers
 */
function registerHandlers(): void {
  // Check Go installation
  ipcMain.handle('go:checkInstallation', async () => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.checkGoInstallation();
  });

  // Get Go tools status
  ipcMain.handle('go:getToolsStatus', async () => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.getToolsStatus();
  });

  // Get module info
  ipcMain.handle('go:getModulesInfo', async (_, modPath?: string) => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.getModulesInfo(modPath);
  });

  // Run Go command
  ipcMain.handle('go:runCommand', async (_, command: string, args: string[] = []) => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.runGo(command, args);
  });

  // Build project
  ipcMain.handle('go:build', async (_, filePath?: string, outputPath?: string) => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.build(filePath, outputPath);
  });

  // Run tests
  ipcMain.handle('go:test', async (_, pattern?: string, filePath?: string) => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.test(pattern, filePath);
  });

  // Format code
  ipcMain.handle('go:format', async (_, filePath: string) => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.formatCode(filePath);
  });

  // Format code content
  ipcMain.handle('go:formatContent', async (_, content: string) => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.formatCodeContent(content);
  });

  // Get diagnostics
  ipcMain.handle('go:getDiagnostics', async (_, filePath?: string) => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.getDiagnostics(filePath);
  });

  // Go mod tidy
  ipcMain.handle('go:modTidy', async () => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.goModTidy();
  });

  // Go mod download
  ipcMain.handle('go:modDownload', async () => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.goModDownload();
  });

  // Get completions
  ipcMain.handle('go:getCompletions', async (_, filePath: string, line: number, column: number) => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.getCompletions(filePath, line, column);
  });

  // Initialize gopls
  ipcMain.handle('go:initializeGopls', async () => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.initializeGopls();
  });

  // Shutdown gopls
  ipcMain.handle('go:shutdownGopls', async () => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.shutdownGopls();
  });

  // Update configuration
  ipcMain.handle('go:updateConfig', async (_, config: Partial<GoConfiguration>) => {
    if (!goProvider) throw new Error('Go provider not initialized');
    goProvider.updateConfig(config);
    return goProvider.getConfig();
  });

  // Get configuration
  ipcMain.handle('go:getConfig', async () => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.getConfig();
  });

  // Install tools
  ipcMain.handle('go:installTools', async (_, tools: string[]) => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.installTools(tools);
  });

  // Get environment info
  ipcMain.handle('go:getEnvInfo', async () => {
    if (!goProvider) throw new Error('Go provider not initialized');
    return goProvider.getEnvInfo();
  });
}

/**
 * Get the Go provider instance
 */
export function getGoProvider(): GoLanguageProvider | null {
  return goProvider;
}

/**
 * Dispose Go language handlers
 */
export function disposeGoIPC(): void {
  if (goProvider) {
    goProvider.dispose();
    goProvider = null;
  }

  // Remove all Go-related IPC handlers
  const handlers = [
    'go:checkInstallation',
    'go:getToolsStatus',
    'go:getModulesInfo',
    'go:runCommand',
    'go:build',
    'go:test',
    'go:format',
    'go:formatContent',
    'go:getDiagnostics',
    'go:modTidy',
    'go:modDownload',
    'go:getCompletions',
    'go:initializeGopls',
    'go:shutdownGopls',
    'go:updateConfig',
    'go:getConfig',
    'go:installTools',
    'go:getEnvInfo'
  ];

  handlers.forEach(handler => {
    ipcMain.removeHandler(handler);
  });
}
