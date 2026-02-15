/**
 * Web Language Support for IDE Kimi IDE
 * Main entry point for TypeScript/JavaScript/JSON/YAML/TOML support
 */

import { WebConfiguration, getWebConfiguration, resetConfiguration } from './config/web-config';
import { TypeScriptProvider } from './providers/typescript-provider';
import { ConfigFileProvider } from './providers/config-provider';
import { WebStatusBar } from './ui/web-status-bar';
import { NPMScriptsPanel } from './ui/npm-scripts-panel';
import { DependenciesPanel } from './ui/dependencies-panel';
import { WebIPCHandler, webPreloadAPI } from './ipc/web-ipc';

// Types
export * from './types';

// Configuration
export { WebConfiguration, getWebConfiguration, resetConfiguration } from './config/web-config';

// Providers
export { TypeScriptProvider } from './providers/typescript-provider';
export { ConfigFileProvider } from './providers/config-provider';

// UI
export { WebStatusBar, type StatusBarItem } from './ui/web-status-bar';
export { NPMScriptsPanel, type ScriptTreeItem } from './ui/npm-scripts-panel';
export { DependenciesPanel, type DependencyTreeItem } from './ui/dependencies-panel';

// IPC
export { WebIPCHandler, webPreloadAPI } from './ipc/web-ipc';

/**
 * Web Language Support Main Class
 * Coordinates all web language features
 */
export class WebLanguageSupport {
  private workspaceRoot: string;
  private config: WebConfiguration;
  private tsProvider: TypeScriptProvider;
  private configProvider: ConfigFileProvider;
  private statusBar: WebStatusBar;
  private scriptsPanel: NPMScriptsPanel;
  private depsPanel: DependenciesPanel;
  private ipcHandler: WebIPCHandler;
  private isInitialized = false;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.config = getWebConfiguration(workspaceRoot);
    this.tsProvider = new TypeScriptProvider(this.config);
    this.configProvider = new ConfigFileProvider(this.config);
    this.statusBar = new WebStatusBar(this.config, this.tsProvider);
    this.scriptsPanel = new NPMScriptsPanel(this.config);
    this.depsPanel = new DependenciesPanel(this.config);
    this.ipcHandler = new WebIPCHandler(
      this.config,
      this.tsProvider,
      this.configProvider,
      this.scriptsPanel,
      this.depsPanel
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Forward status bar events
    this.statusBar.on('changed', (items) => {
      // Would notify renderer of status changes
      console.log('Status bar updated:', items);
    });

    // Forward scripts panel events
    this.scriptsPanel.on('refresh', () => {
      console.log('Scripts panel refreshed');
    });

    // Forward dependencies panel events
    this.depsPanel.on('refresh', () => {
      console.log('Dependencies panel refreshed');
    });
  }

  /**
   * Initialize all web language features
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize TypeScript provider
      await this.tsProvider.initialize();

      // Refresh status bar
      await this.statusBar.refresh();
      this.statusBar.updatePackageManagerStatus();

      this.isInitialized = true;
      console.log('Web Language Support initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Web Language Support:', error);
      throw error;
    }
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.tsProvider.dispose();
    this.statusBar.dispose();
    this.scriptsPanel.dispose();
    this.depsPanel.dispose();
    this.ipcHandler.dispose();
    resetConfiguration();
    this.isInitialized = false;
  }

  /**
   * Check if web language support is initialized
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  // ============ Getters ============

  public getConfiguration(): WebConfiguration {
    return this.config;
  }

  public getTSProvider(): TypeScriptProvider {
    return this.tsProvider;
  }

  public getConfigProvider(): ConfigFileProvider {
    return this.configProvider;
  }

  public getStatusBar(): WebStatusBar {
    return this.statusBar;
  }

  public getScriptsPanel(): NPMScriptsPanel {
    return this.scriptsPanel;
  }

  public getDependenciesPanel(): DependenciesPanel {
    return this.depsPanel;
  }

  public getIPCHandler(): WebIPCHandler {
    return this.ipcHandler;
  }

  // ============ Convenience Methods ============

  /**
   * Get diagnostics for a file
   */
  public async getDiagnostics(filePath: string, content?: string) {
    return this.tsProvider.getDiagnostics(filePath, content);
  }

  /**
   * Format code
   */
  public async formatCode(filePath: string, content: string) {
    if (this.configProvider.isConfigFile(filePath)) {
      return this.configProvider.formatCode(filePath, content);
    }
    return this.tsProvider.formatCode(filePath, content);
  }

  /**
   * Get completions
   */
  public async getCompletions(filePath: string, position: { line: number; character: number }, content?: string) {
    if (this.configProvider.isConfigFile(filePath)) {
      return this.configProvider.getCompletions(filePath, position, content || '');
    }
    return this.tsProvider.getCompletions(filePath, position, content);
  }

  /**
   * Run npm script
   */
  public async runScript(scriptName: string, args?: string[]) {
    return this.scriptsPanel.runScript(scriptName, args);
  }

  /**
   * Install packages
   */
  public async installPackages(packages: string[], dev?: boolean) {
    const type = dev ? 'devDependency' : 'dependency';
    const results = await this.depsPanel.installPackages(packages, type);
    return results;
  }

  /**
   * Get current status
   */
  public async getStatus() {
    return {
      typescript: await this.tsProvider.getTSStatus(),
      eslint: this.tsProvider.getESLintStatus(),
      prettier: this.tsProvider.getPrettierStatus(),
      packageManager: this.config.detectPackageManager(),
    };
  }
}

/**
 * Create web language support instance
 */
export function createWebLanguageSupport(workspaceRoot: string): WebLanguageSupport {
  return new WebLanguageSupport(workspaceRoot);
}

// Default export
export default WebLanguageSupport;
