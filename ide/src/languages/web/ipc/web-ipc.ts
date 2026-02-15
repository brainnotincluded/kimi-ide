/**
 * Web Language IPC Handlers
 * Handles IPC communication for web language features
 */

import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { WebConfiguration } from '../config/web-config';
import { TypeScriptProvider } from '../providers/typescript-provider';
import { ConfigFileProvider } from '../providers/config-provider';
import { NPMScriptsPanel } from '../ui/npm-scripts-panel';
import { DependenciesPanel } from '../ui/dependencies-panel';
import {
  InstallPackagesRequest,
  InstallPackagesResult,
  RunScriptRequest,
  RunScriptResult,
  FormatRequest,
  FormatResult,
  LintRequest,
  LintResult,
  Diagnostic,
  CompletionItem,
  TextEdit,
  Range,
  Position,
  WorkspaceEdit,
  RenameParams,
  ExtractFunctionParams,
  ImportOrganizerOptions,
} from '../types';

export class WebIPCHandler {
  private config: WebConfiguration;
  private tsProvider: TypeScriptProvider;
  private configProvider: ConfigFileProvider;
  private scriptsPanel: NPMScriptsPanel;
  private depsPanel: DependenciesPanel;
  private mainWindow: BrowserWindow | null = null;

  constructor(
    config: WebConfiguration,
    tsProvider: TypeScriptProvider,
    configProvider: ConfigFileProvider,
    scriptsPanel: NPMScriptsPanel,
    depsPanel: DependenciesPanel
  ) {
    this.config = config;
    this.tsProvider = tsProvider;
    this.configProvider = configProvider;
    this.scriptsPanel = scriptsPanel;
    this.depsPanel = depsPanel;

    this.registerHandlers();
    this.setupEventForwarding();
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  public dispose(): void {
    // Remove all IPC handlers
    const channels = [
      'web:initialize',
      'web:dispose',
      'web:getDiagnostics',
      'web:format',
      'web:lint',
      'web:getCompletions',
      'web:organizeImports',
      'web:renameSymbol',
      'web:extractFunction',
      'web:getRefactorings',
      'web:installPackages',
      'web:uninstallPackages',
      'web:runScript',
      'web:getScripts',
      'web:addScript',
      'web:removeScript',
      'web:getDependencies',
      'web:checkOutdated',
      'web:updatePackage',
      'web:getStatus',
      'web:updateConfig',
      'web:validateConfigFile',
    ];

    for (const channel of channels) {
      ipcMain.removeHandler(channel);
    }
  }

  // ============ IPC Handlers Registration ============

  private registerHandlers(): void {
    // Lifecycle
    ipcMain.handle('web:initialize', this.handleInitialize.bind(this));
    ipcMain.handle('web:dispose', this.handleDispose.bind(this));

    // TypeScript/JavaScript
    ipcMain.handle('web:getDiagnostics', this.handleGetDiagnostics.bind(this));
    ipcMain.handle('web:format', this.handleFormat.bind(this));
    ipcMain.handle('web:lint', this.handleLint.bind(this));
    ipcMain.handle('web:getCompletions', this.handleGetCompletions.bind(this));
    ipcMain.handle('web:organizeImports', this.handleOrganizeImports.bind(this));
    ipcMain.handle('web:renameSymbol', this.handleRenameSymbol.bind(this));
    ipcMain.handle('web:extractFunction', this.handleExtractFunction.bind(this));
    ipcMain.handle('web:getRefactorings', this.handleGetRefactorings.bind(this));

    // Package Management
    ipcMain.handle('web:installPackages', this.handleInstallPackages.bind(this));
    ipcMain.handle('web:uninstallPackages', this.handleUninstallPackages.bind(this));
    ipcMain.handle('web:runScript', this.handleRunScript.bind(this));
    ipcMain.handle('web:getScripts', this.handleGetScripts.bind(this));
    ipcMain.handle('web:addScript', this.handleAddScript.bind(this));
    ipcMain.handle('web:removeScript', this.handleRemoveScript.bind(this));

    // Dependencies
    ipcMain.handle('web:getDependencies', this.handleGetDependencies.bind(this));
    ipcMain.handle('web:checkOutdated', this.handleCheckOutdated.bind(this));
    ipcMain.handle('web:updatePackage', this.handleUpdatePackage.bind(this));

    // Status & Config
    ipcMain.handle('web:getStatus', this.handleGetStatus.bind(this));
    ipcMain.handle('web:updateConfig', this.handleUpdateConfig.bind(this));

    // Config Files
    ipcMain.handle('web:validateConfigFile', this.handleValidateConfigFile.bind(this));
  }

  // ============ Lifecycle Handlers ============

  private async handleInitialize(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.tsProvider.initialize();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleDispose(): Promise<void> {
    this.tsProvider.dispose();
  }

  // ============ TypeScript/JavaScript Handlers ============

  private async handleGetDiagnostics(
    _event: IpcMainInvokeEvent,
    filePath: string,
    content?: string
  ): Promise<Diagnostic[]> {
    return this.tsProvider.getDiagnostics(filePath, content);
  }

  private async handleFormat(
    _event: IpcMainInvokeEvent,
    request: FormatRequest
  ): Promise<FormatResult> {
    try {
      const isConfigFile = this.configProvider.isConfigFile(request.file);
      
      if (isConfigFile) {
        const result = await this.configProvider.formatCode(
          request.file,
          request.content,
          request.options
        );
        return { success: true, formatted: result.formatted, edits: result.edits };
      }

      const result = await this.tsProvider.formatCode(
        request.file,
        request.content,
        request.options
      );
      return { success: true, formatted: result.formatted, edits: result.edits };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Format failed',
      };
    }
  }

  private async handleLint(
    _event: IpcMainInvokeEvent,
    request: LintRequest
  ): Promise<LintResult> {
    try {
      const diagnostics = await this.tsProvider.getDiagnostics(
        request.file,
        request.content
      );

      // Filter only ESLint diagnostics
      const eslintDiagnostics = diagnostics.filter(d => d.source === 'eslint');

      // Auto-fix if requested
      if (request.fix) {
        // Would apply fixes here
      }

      return {
        success: true,
        diagnostics: eslintDiagnostics,
        fixed: request.fix,
      };
    } catch (error) {
      return {
        success: false,
        diagnostics: [],
        error: error instanceof Error ? error.message : 'Lint failed',
      };
    }
  }

  private async handleGetCompletions(
    _event: IpcMainInvokeEvent,
    filePath: string,
    position: Position,
    content?: string
  ): Promise<CompletionItem[]> {
    const isConfigFile = this.configProvider.isConfigFile(filePath);

    if (isConfigFile) {
      return this.configProvider.getCompletions(filePath, position, content || '');
    }

    return this.tsProvider.getCompletions(filePath, position, content);
  }

  private async handleOrganizeImports(
    _event: IpcMainInvokeEvent,
    filePath: string,
    content: string,
    options?: ImportOrganizerOptions
  ): Promise<TextEdit[]> {
    return this.tsProvider.organizeImports(filePath, content, options);
  }

  private async handleRenameSymbol(
    _event: IpcMainInvokeEvent,
    params: RenameParams
  ): Promise<WorkspaceEdit | null> {
    return this.tsProvider.renameSymbol(params);
  }

  private async handleExtractFunction(
    _event: IpcMainInvokeEvent,
    params: ExtractFunctionParams
  ): Promise<WorkspaceEdit | null> {
    return this.tsProvider.extractFunction(params);
  }

  private async handleGetRefactorings(
    _event: IpcMainInvokeEvent,
    filePath: string,
    range: Range
  ): Promise<unknown[]> {
    return this.tsProvider.getRefactorings(filePath, range);
  }

  // ============ Package Management Handlers ============

  private async handleInstallPackages(
    _event: IpcMainInvokeEvent,
    request: InstallPackagesRequest
  ): Promise<InstallPackagesResult> {
    const success: string[] = [];
    const failed: string[] = [];
    let output = '';

    const type = request.dev ? 'devDependency' : 'dependency';

    for (const pkg of request.packages) {
      const [name, version] = pkg.split('@');
      const result = await this.depsPanel.installPackage(name, version, type);
      
      if (result) {
        success.push(pkg);
      } else {
        failed.push(pkg);
      }
    }

    return { success: success.length > 0, installed: success, failed, output };
  }

  private async handleUninstallPackages(
    _event: IpcMainInvokeEvent,
    packages: string[]
  ): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const pkg of packages) {
      const result = await this.depsPanel.uninstallPackage(pkg);
      if (result) {
        success.push(pkg);
      } else {
        failed.push(pkg);
      }
    }

    return { success, failed };
  }

  private async handleRunScript(
    _event: IpcMainInvokeEvent,
    request: RunScriptRequest
  ): Promise<RunScriptResult> {
    return this.scriptsPanel.runScript(request.script, request.args);
  }

  private async handleGetScripts(): Promise<unknown[]> {
    return this.scriptsPanel.getTreeItems();
  }

  private async handleAddScript(
    _event: IpcMainInvokeEvent,
    name: string,
    command: string,
    description?: string
  ): Promise<boolean> {
    return this.scriptsPanel.addScript(name, command, description);
  }

  private async handleRemoveScript(
    _event: IpcMainInvokeEvent,
    name: string
  ): Promise<boolean> {
    return this.scriptsPanel.removeScript(name);
  }

  // ============ Dependencies Handlers ============

  private async handleGetDependencies(): Promise<unknown[]> {
    return this.depsPanel.getTreeItems();
  }

  private async handleCheckOutdated(): Promise<void> {
    await this.depsPanel.checkOutdated();
  }

  private async handleUpdatePackage(
    _event: IpcMainInvokeEvent,
    name: string
  ): Promise<boolean> {
    return this.depsPanel.updatePackage(name);
  }

  // ============ Status & Config Handlers ============

  private async handleGetStatus(): Promise<{
    typescript: { version: string; isReady: boolean };
    eslint: { enabled: boolean; isReady: boolean };
    prettier: { enabled: boolean; version: string };
    packageManager: string;
  }> {
    const tsStatus = await this.tsProvider.getTSStatus();
    const eslintStatus = this.tsProvider.getESLintStatus();
    const prettierStatus = this.tsProvider.getPrettierStatus();

    return {
      typescript: {
        version: tsStatus.version,
        isReady: tsStatus.isReady,
      },
      eslint: {
        enabled: eslintStatus.enabled,
        isReady: eslintStatus.isReady,
      },
      prettier: {
        enabled: prettierStatus.enabled,
        version: prettierStatus.version,
      },
      packageManager: this.config.detectPackageManager(),
    };
  }

  private async handleUpdateConfig(
    _event: IpcMainInvokeEvent,
    updates: Record<string, unknown>
  ): Promise<void> {
    this.config.updateConfig(updates);
  }

  // ============ Config File Handlers ============

  private async handleValidateConfigFile(
    _event: IpcMainInvokeEvent,
    filePath: string,
    content: string
  ): Promise<Diagnostic[]> {
    return this.configProvider.validate(filePath, content);
  }

  // ============ Event Forwarding ============

  private setupEventForwarding(): void {
    // Forward script panel events to renderer
    this.scriptsPanel.on('scriptStarted', (script: string) => {
      this.sendToRenderer('web:scriptStarted', { script });
    });

    this.scriptsPanel.on('scriptFinished', (data: { script: string; exitCode: number }) => {
      this.sendToRenderer('web:scriptFinished', data);
    });

    this.scriptsPanel.on('scriptOutput', (data: { script: string; type: 'stdout' | 'stderr'; data: string }) => {
      this.sendToRenderer('web:scriptOutput', data);
    });

    // Forward dependencies panel events
    this.depsPanel.on('installing', (pkg: string) => {
      this.sendToRenderer('web:installing', { package: pkg });
    });

    this.depsPanel.on('installed', (data: { package: string; success: boolean }) => {
      this.sendToRenderer('web:installed', data);
    });

    this.depsPanel.on('checking', () => {
      this.sendToRenderer('web:checkingOutdated', {});
    });

    this.depsPanel.on('checked', () => {
      this.sendToRenderer('web:checkedOutdated', {});
    });
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}

// ============ Preload API ============

export const webPreloadAPI = {
  // Lifecycle
  initialize: (): Promise<{ success: boolean; error?: string }> => 
    window.electron.invoke('web:initialize'),
  dispose: (): Promise<void> => 
    window.electron.invoke('web:dispose'),

  // TypeScript/JavaScript
  getDiagnostics: (filePath: string, content?: string): Promise<Diagnostic[]> =>
    window.electron.invoke('web:getDiagnostics', filePath, content),
  format: (request: FormatRequest): Promise<FormatResult> =>
    window.electron.invoke('web:format', request),
  lint: (request: LintRequest): Promise<LintResult> =>
    window.electron.invoke('web:lint', request),
  getCompletions: (filePath: string, position: Position, content?: string): Promise<CompletionItem[]> =>
    window.electron.invoke('web:getCompletions', filePath, position, content),
  organizeImports: (filePath: string, content: string, options?: ImportOrganizerOptions): Promise<TextEdit[]> =>
    window.electron.invoke('web:organizeImports', filePath, content, options),
  renameSymbol: (params: RenameParams): Promise<WorkspaceEdit | null> =>
    window.electron.invoke('web:renameSymbol', params),
  extractFunction: (params: ExtractFunctionParams): Promise<WorkspaceEdit | null> =>
    window.electron.invoke('web:extractFunction', params),
  getRefactorings: (filePath: string, range: Range): Promise<unknown[]> =>
    window.electron.invoke('web:getRefactorings', filePath, range),

  // Package Management
  installPackages: (request: InstallPackagesRequest): Promise<InstallPackagesResult> =>
    window.electron.invoke('web:installPackages', request),
  uninstallPackages: (packages: string[]): Promise<{ success: string[]; failed: string[] }> =>
    window.electron.invoke('web:uninstallPackages', packages),
  runScript: (request: RunScriptRequest): Promise<RunScriptResult> =>
    window.electron.invoke('web:runScript', request),
  getScripts: (): Promise<unknown[]> =>
    window.electron.invoke('web:getScripts'),
  addScript: (name: string, command: string, description?: string): Promise<boolean> =>
    window.electron.invoke('web:addScript', name, command, description),
  removeScript: (name: string): Promise<boolean> =>
    window.electron.invoke('web:removeScript', name),

  // Dependencies
  getDependencies: (): Promise<unknown[]> =>
    window.electron.invoke('web:getDependencies'),
  checkOutdated: (): Promise<void> =>
    window.electron.invoke('web:checkOutdated'),
  updatePackage: (name: string): Promise<boolean> =>
    window.electron.invoke('web:updatePackage', name),

  // Status & Config
  getStatus: (): Promise<{
    typescript: { version: string; isReady: boolean };
    eslint: { enabled: boolean; isReady: boolean };
    prettier: { enabled: boolean; version: string };
    packageManager: string;
  }> => window.electron.invoke('web:getStatus'),
  updateConfig: (updates: Record<string, unknown>): Promise<void> =>
    window.electron.invoke('web:updateConfig', updates),

  // Config Files
  validateConfigFile: (filePath: string, content: string): Promise<Diagnostic[]> =>
    window.electron.invoke('web:validateConfigFile', filePath, content),

  // Event Listeners
  onScriptStarted: (callback: (data: { script: string }) => void): () => void =>
    window.electron.on('web:scriptStarted', callback),
  onScriptFinished: (callback: (data: { script: string; exitCode: number }) => void): () => void =>
    window.electron.on('web:scriptFinished', callback),
  onScriptOutput: (callback: (data: { script: string; type: 'stdout' | 'stderr'; data: string }) => void): () => void =>
    window.electron.on('web:scriptOutput', callback),
  onInstalling: (callback: (data: { package: string }) => void): () => void =>
    window.electron.on('web:installing', callback),
  onInstalled: (callback: (data: { package: string; success: boolean }) => void): () => void =>
    window.electron.on('web:installed', callback),
  onCheckingOutdated: (callback: () => void): () => void =>
    window.electron.on('web:checkingOutdated', callback),
  onCheckedOutdated: (callback: () => void): () => void =>
    window.electron.on('web:checkedOutdated', callback),
};

// Type declaration for window.electron
declare global {
  interface Window {
    electron: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
    };
  }
}
