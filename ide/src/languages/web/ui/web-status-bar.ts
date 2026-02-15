/**
 * Web Status Bar
 * Shows TypeScript version, ESLint status, Prettier status
 */

import { EventEmitter } from 'events';
import {
  TSStatus,
  ESLintStatus,
  PrettierStatus,
  WebLanguageStatus,
} from '../types';
import { WebConfiguration } from '../config/web-config';
import { TypeScriptProvider } from '../providers/typescript-provider';

export interface StatusBarItem {
  id: string;
  text: string;
  tooltip: string;
  command?: string;
  color?: string;
  priority: number;
}

export class WebStatusBar extends EventEmitter {
  private config: WebConfiguration;
  private tsProvider: TypeScriptProvider;
  private items: Map<string, StatusBarItem> = new Map();
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(config: WebConfiguration, tsProvider: TypeScriptProvider) {
    super();
    this.config = config;
    this.tsProvider = tsProvider;
    this.initialize();
  }

  private initialize(): void {
    // Initialize status items
    this.updateTSStatus({
      version: 'loading...',
      isReady: false,
      projectCount: 0,
      fileCount: 0,
    });

    this.updateESLintStatus({
      enabled: this.config.isESLintEnabled(),
      isReady: false,
      rulesCount: 0,
    });

    this.updatePrettierStatus({
      enabled: false,
      version: 'unknown',
    });

    // Start periodic refresh
    this.startRefresh();
  }

  public dispose(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.removeAllListeners();
  }

  private startRefresh(): void {
    // Initial refresh
    this.refresh();

    // Refresh every 5 seconds
    this.refreshInterval = setInterval(() => {
      this.refresh();
    }, 5000);
  }

  public async refresh(): Promise<void> {
    await Promise.all([
      this.refreshTSStatus(),
      this.refreshESLintStatus(),
      this.refreshPrettierStatus(),
    ]);

    this.emit('changed', this.getAllItems());
  }

  // ============ TypeScript Status ============

  private async refreshTSStatus(): Promise<void> {
    try {
      const status = await this.tsProvider.getTSStatus();
      this.updateTSStatus(status);
    } catch (error) {
      console.error('Failed to refresh TS status:', error);
    }
  }

  private updateTSStatus(status: TSStatus): void {
    const item: StatusBarItem = {
      id: 'typescript',
      text: `$(typescript) ${status.version}`,
      tooltip: this.buildTSTooltip(status),
      command: 'web.selectTSVersion',
      color: status.isReady ? undefined : '#FFA500',
      priority: 100,
    };

    this.items.set('typescript', item);
  }

  private buildTSTooltip(status: TSStatus): string {
    const lines = [
      `TypeScript ${status.version}`,
      `Status: ${status.isReady ? 'Ready' : 'Initializing...'}`,
    ];

    if (status.projectCount > 0) {
      lines.push(`Projects: ${status.projectCount}`);
    }
    if (status.fileCount > 0) {
      lines.push(`Files: ${status.fileCount}`);
    }

    lines.push('', 'Click to select TypeScript version');

    return lines.join('\n');
  }

  // ============ ESLint Status ============

  private async refreshESLintStatus(): Promise<void> {
    const status = this.tsProvider.getESLintStatus();
    this.updateESLintStatus(status);
  }

  private updateESLintStatus(status: ESLintStatus): void {
    let icon: string;
    let color: string | undefined;

    if (!status.enabled) {
      icon = '$(circle-slash)';
      color = '#888888';
    } else if (status.isReady) {
      icon = '$(check)';
      color = '#4CAF50';
    } else {
      icon = '$(warning)';
      color = '#FFA500';
    }

    const item: StatusBarItem = {
      id: 'eslint',
      text: `${icon} ESLint`,
      tooltip: this.buildESLintTooltip(status),
      command: 'web.toggleESLint',
      color,
      priority: 90,
    };

    this.items.set('eslint', item);
  }

  private buildESLintTooltip(status: ESLintStatus): string {
    const lines = [
      'ESLint',
      `Status: ${status.enabled ? (status.isReady ? 'Active' : 'Not Configured') : 'Disabled'}`,
    ];

    if (status.configPath) {
      lines.push(`Config: ${status.configPath}`);
    }

    if (status.rulesCount > 0) {
      lines.push(`Rules: ${status.rulesCount}`);
    }

    lines.push('', `Click to ${status.enabled ? 'disable' : 'enable'} ESLint`);

    return lines.join('\n');
  }

  // ============ Prettier Status ============

  private async refreshPrettierStatus(): Promise<void> {
    const status = this.tsProvider.getPrettierStatus();
    this.updatePrettierStatus(status);
  }

  private updatePrettierStatus(status: PrettierStatus): void {
    let icon: string;
    let color: string | undefined;

    if (!status.enabled) {
      icon = '$(circle-slash)';
      color = '#888888';
    } else {
      icon = '$(check)';
      color = '#4CAF50';
    }

    const item: StatusBarItem = {
      id: 'prettier',
      text: `${icon} Prettier`,
      tooltip: this.buildPrettierTooltip(status),
      command: 'web.openPrettierConfig',
      color,
      priority: 80,
    };

    this.items.set('prettier', item);
  }

  private buildPrettierTooltip(status: PrettierStatus): string {
    const lines = [
      'Prettier',
      `Version: ${status.version}`,
      `Status: ${status.enabled ? 'Active' : 'Not Configured'}`,
    ];

    if (status.configPath) {
      lines.push(`Config: ${status.configPath}`);
    }

    const prettierOptions = this.config.getPrettierOptions();
    lines.push(
      '',
      'Settings:',
      `  Tab Width: ${prettierOptions.tabWidth}`,
      `  Semicolons: ${prettierOptions.semi}`,
      `  Single Quote: ${prettierOptions.singleQuote}`,
      `  Trailing Comma: ${prettierOptions.trailingComma}`
    );

    lines.push('', 'Click to open Prettier configuration');

    return lines.join('\n');
  }

  // ============ Package Manager Status ============

  public updatePackageManagerStatus(): void {
    const pm = this.config.detectPackageManager();
    
    const icons: Record<string, string> = {
      npm: '$(package)',
      yarn: '$(package)',
      pnpm: '$(package)',
      bun: '$(package)',
      none: '$(circle-slash)',
    };

    const item: StatusBarItem = {
      id: 'packageManager',
      text: `${icons[pm]} ${pm}`,
      tooltip: `Package Manager: ${pm}`,
      command: 'web.selectPackageManager',
      priority: 70,
    };

    this.items.set('packageManager', item);
    this.emit('changed', this.getAllItems());
  }

  // ============ Public API ============

  public getAllItems(): StatusBarItem[] {
    return Array.from(this.items.values()).sort((a, b) => b.priority - a.priority);
  }

  public getItem(id: string): StatusBarItem | undefined {
    return this.items.get(id);
  }

  public getFullStatus(): WebLanguageStatus {
    return {
      typescript: {
        version: this.items.get('typescript')?.text.replace('$(typescript) ', '') || 'unknown',
        isReady: !this.items.get('typescript')?.color,
        projectCount: 0,
        fileCount: 0,
      },
      eslint: {
        enabled: !this.items.get('eslint')?.text.includes('slash'),
        isReady: this.items.get('eslint')?.text.includes('check') || false,
        rulesCount: 0,
      },
      prettier: {
        enabled: !this.items.get('prettier')?.text.includes('slash'),
        version: 'unknown',
      },
      packageManager: this.config.detectPackageManager(),
    };
  }

  // Status bar item click handlers
  public async selectTSVersion(): Promise<void> {
    // Would show quick pick to select TS version
    this.emit('command', 'selectTSVersion');
  }

  public async toggleESLint(): Promise<void> {
    const config = this.config.getConfig();
    this.config.updateConfig({
      eslint: { ...config.eslint, enabled: !config.eslint.enabled },
    });
    await this.refresh();
  }

  public async openPrettierConfig(): Promise<void> {
    this.emit('command', 'openPrettierConfig');
  }

  public async selectPackageManager(): Promise<void> {
    this.emit('command', 'selectPackageManager');
  }
}
