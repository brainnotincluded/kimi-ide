/**
 * NPM Scripts Panel
 * Shows and runs scripts from package.json
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import { PackageJson, NPMScript, RunScriptResult } from '../types';
import { WebConfiguration } from '../config/web-config';
import { spawn } from 'child_process';

export interface ScriptTreeItem {
  id: string;
  label: string;
  description?: string;
  script?: NPMScript;
  category?: string;
  icon?: string;
  children?: ScriptTreeItem[];
  command?: string;
  tooltip?: string;
  contextValue?: string;
}

export class NPMScriptsPanel extends EventEmitter {
  private config: WebConfiguration;
  private scripts: Map<string, NPMScript> = new Map();
  private packageJson: PackageJson | null = null;
  private runningScripts = new Set<string>();
  private fileWatcher: fs.FSWatcher | null = null;

  constructor(config: WebConfiguration) {
    super();
    this.config = config;
    this.initialize();
  }

  private initialize(): void {
    this.loadPackageJson();
    this.setupFileWatcher();
  }

  public dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    this.removeAllListeners();
  }

  // ============ Package.json Loading ============

  private setupFileWatcher(): void {
    const packageJsonPath = path.join(this.config.getWorkspaceRoot(), 'package.json');
    
    try {
      this.fileWatcher = fs.watch(packageJsonPath, (eventType) => {
        if (eventType === 'change') {
          this.loadPackageJson();
          this.emit('refresh');
        }
      });
    } catch (error) {
      console.warn('Failed to watch package.json:', error);
    }
  }

  private loadPackageJson(): void {
    const packageJsonPath = path.join(this.config.getWorkspaceRoot(), 'package.json');
    
    try {
      if (fs.existsSync(packageJsonPath)) {
        const content = fs.readFileSync(packageJsonPath, 'utf-8');
        this.packageJson = JSON.parse(content);
        this.parseScripts();
      } else {
        this.packageJson = null;
        this.scripts.clear();
      }
    } catch (error) {
      console.error('Failed to load package.json:', error);
      this.packageJson = null;
      this.scripts.clear();
    }
  }

  private parseScripts(): void {
    this.scripts.clear();

    if (!this.packageJson?.scripts) {
      return;
    }

    for (const [name, command] of Object.entries(this.packageJson.scripts)) {
      this.scripts.set(name, {
        name,
        command,
        description: this.getScriptDescription(name),
      });
    }
  }

  private getScriptDescription(name: string): string | undefined {
    const descriptions: Record<string, string> = {
      'start': 'Start the application',
      'build': 'Build the project',
      'dev': 'Start development server',
      'serve': 'Serve the application',
      'test': 'Run tests',
      'test:unit': 'Run unit tests',
      'test:e2e': 'Run end-to-end tests',
      'test:coverage': 'Run tests with coverage',
      'lint': 'Run linter',
      'lint:fix': 'Run linter and fix issues',
      'format': 'Format code',
      'type-check': 'Run TypeScript type checking',
      'clean': 'Clean build artifacts',
      'install': 'Install dependencies',
      'ci': 'Run CI tasks',
      'deploy': 'Deploy the application',
      'preview': 'Preview production build',
    };

    return descriptions[name];
  }

  // ============ Tree Data ============

  public getTreeItems(): ScriptTreeItem[] {
    if (!this.packageJson) {
      return [{
        id: 'no-package',
        label: 'No package.json found',
        description: 'Create a package.json to see npm scripts',
        icon: '$(info)',
      }];
    }

    const items: ScriptTreeItem[] = [];

    // Project info
    items.push({
      id: 'project-info',
      label: this.packageJson.name || 'Unnamed Project',
      description: this.packageJson.version || '',
      icon: '$(package)',
      children: [
        {
          id: 'project-version',
          label: `Version: ${this.packageJson.version || 'N/A'}`,
          icon: '$(tag)',
        },
        {
          id: 'project-main',
          label: `Main: ${this.packageJson.main || 'N/A'}`,
          icon: '$(file)',
        },
      ],
    });

    // Categorized scripts
    const categories = this.categorizeScripts();
    
    for (const [category, scripts] of categories) {
      const categoryItem: ScriptTreeItem = {
        id: `category-${category}`,
        label: category,
        icon: this.getCategoryIcon(category),
        children: scripts.map(script => ({
          id: `script-${script.name}`,
          label: script.name,
          description: script.description || '',
          script,
          icon: this.runningScripts.has(script.name) ? '$(sync~spin)' : '$(play)',
          tooltip: `${script.name}: ${script.command}`,
          command: 'web.runScript',
          contextValue: 'script',
        })),
      };

      items.push(categoryItem);
    }

    return items;
  }

  private categorizeScripts(): Map<string, NPMScript[]> {
    const categories = new Map<string, NPMScript[]>();

    // Define category patterns
    const patterns: { name: string; patterns: RegExp[] }[] = [
      { name: 'Development', patterns: [/^(dev|start|serve|preview)$/] },
      { name: 'Build', patterns: [/^(build|compile|transpile|bundle|dist)$/] },
      { name: 'Testing', patterns: [/^(test|spec|e2e|coverage|jest|vitest|cypress|playwright)/] },
      { name: 'Linting', patterns: [/^(lint|eslint|prettier|stylelint|format)/] },
      { name: 'Type Checking', patterns: [/^(type|tsc|ts-check)/] },
      { name: 'Maintenance', patterns: [/^(clean|reset|reinstall|prune|audit|update|upgrade|outdated)$/] },
      { name: 'CI/CD', patterns: [/^(ci|deploy|publish|release|docker|buildkite|github)/] },
    ];

    // Initialize categories
    for (const { name } of patterns) {
      categories.set(name, []);
    }
    categories.set('Other', []);

    // Categorize scripts
    for (const script of this.scripts.values()) {
      let categorized = false;

      for (const { name, patterns: p } of patterns) {
        if (p.some(pattern => pattern.test(script.name))) {
          categories.get(name)!.push(script);
          categorized = true;
          break;
        }
      }

      if (!categorized) {
        categories.get('Other')!.push(script);
      }
    }

    // Remove empty categories
    for (const [name, scripts] of categories) {
      if (scripts.length === 0) {
        categories.delete(name);
      }
    }

    return categories;
  }

  private getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'Development': '$(debug-start)',
      'Build': '$(tools)',
      'Testing': '$(beaker)',
      'Linting': '$(checklist)',
      'Type Checking': '$(symbol-type-parameter)',
      'Maintenance': '$(wrench)',
      'CI/CD': '$(rocket)',
      'Other': '$(ellipsis)',
    };

    return icons[category] || '$(symbol-method)';
  }

  // ============ Script Execution ============

  public async runScript(scriptName: string, args: string[] = []): Promise<RunScriptResult> {
    const script = this.scripts.get(scriptName);
    if (!script) {
      return {
        success: false,
        stdout: '',
        stderr: `Script "${scriptName}" not found`,
        exitCode: 1,
      };
    }

    this.runningScripts.add(scriptName);
    this.emit('scriptStarted', scriptName);

    const packageManager = this.config.detectPackageManager();
    const command = this.getPackageManagerCommand(packageManager);

    return new Promise((resolve) => {
      const child = spawn(command.bin, [...command.args, scriptName, ...args], {
        cwd: this.config.getWorkspaceRoot(),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: {
          ...process.env,
          FORCE_COLOR: '1',
        },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        this.emit('scriptOutput', { script: scriptName, type: 'stdout', data: text });
      });

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        this.emit('scriptOutput', { script: scriptName, type: 'stderr', data: text });
      });

      child.on('close', (code) => {
        this.runningScripts.delete(scriptName);
        this.emit('scriptFinished', { script: scriptName, exitCode: code || 0 });

        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      child.on('error', (error) => {
        this.runningScripts.delete(scriptName);
        this.emit('scriptFinished', { script: scriptName, error });

        resolve({
          success: false,
          stdout,
          stderr: error.message,
          exitCode: 1,
        });
      });
    });
  }

  private getPackageManagerCommand(pm: string): { bin: string; args: string[] } {
    switch (pm) {
      case 'yarn':
        return { bin: 'yarn', args: ['run'] };
      case 'pnpm':
        return { bin: 'pnpm', args: ['run'] };
      case 'bun':
        return { bin: 'bun', args: ['run'] };
      case 'npm':
      default:
        return { bin: 'npm', args: ['run'] };
    }
  }

  public async runInstall(): Promise<RunScriptResult> {
    const packageManager = this.config.detectPackageManager();
    const command = this.getInstallCommand(packageManager);

    return new Promise((resolve) => {
      const child = spawn(command.bin, command.args, {
        cwd: this.config.getWorkspaceRoot(),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: {
          ...process.env,
          FORCE_COLOR: '1',
        },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        this.emit('scriptOutput', { script: 'install', type: 'stdout', data: text });
      });

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        this.emit('scriptOutput', { script: 'install', type: 'stderr', data: text });
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          stdout,
          stderr: error.message,
          exitCode: 1,
        });
      });
    });
  }

  private getInstallCommand(pm: string): { bin: string; args: string[] } {
    switch (pm) {
      case 'yarn':
        return { bin: 'yarn', args: ['install'] };
      case 'pnpm':
        return { bin: 'pnpm', args: ['install'] };
      case 'bun':
        return { bin: 'bun', args: ['install'] };
      case 'npm':
      default:
        return { bin: 'npm', args: ['install'] };
    }
  }

  // ============ Script Management ============

  public async addScript(name: string, command: string, description?: string): Promise<boolean> {
    if (!this.packageJson) {
      return false;
    }

    const packageJsonPath = path.join(this.config.getWorkspaceRoot(), 'package.json');
    
    try {
      this.packageJson.scripts = this.packageJson.scripts || {};
      this.packageJson.scripts[name] = command;

      fs.writeFileSync(packageJsonPath, JSON.stringify(this.packageJson, null, 2));
      
      this.scripts.set(name, { name, command, description });
      this.emit('refresh');
      
      return true;
    } catch (error) {
      console.error('Failed to add script:', error);
      return false;
    }
  }

  public async removeScript(name: string): Promise<boolean> {
    if (!this.packageJson?.scripts || !this.packageJson.scripts[name]) {
      return false;
    }

    const packageJsonPath = path.join(this.config.getWorkspaceRoot(), 'package.json');
    
    try {
      delete this.packageJson.scripts[name];
      fs.writeFileSync(packageJsonPath, JSON.stringify(this.packageJson, null, 2));
      
      this.scripts.delete(name);
      this.emit('refresh');
      
      return true;
    } catch (error) {
      console.error('Failed to remove script:', error);
      return false;
    }
  }

  // ============ Public API ============

  public getScripts(): NPMScript[] {
    return Array.from(this.scripts.values());
  }

  public getScript(name: string): NPMScript | undefined {
    return this.scripts.get(name);
  }

  public isRunning(scriptName: string): boolean {
    return this.runningScripts.has(scriptName);
  }

  public refresh(): void {
    this.loadPackageJson();
    this.emit('refresh');
  }
}
