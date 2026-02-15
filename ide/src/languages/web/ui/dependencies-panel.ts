/**
 * Dependencies Panel
 * Shows npm/yarn/pnpm dependencies with version info
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { PackageJson, DependencyInfo } from '../types';
import { WebConfiguration } from '../config/web-config';

export interface DependencyTreeItem {
  id: string;
  label: string;
  description?: string;
  tooltip?: string;
  icon?: string;
  contextValue?: string;
  children?: DependencyTreeItem[];
  dependency?: DependencyInfo;
  command?: string;
  collapsible?: boolean;
}

export class DependenciesPanel extends EventEmitter {
  private config: WebConfiguration;
  private dependencies = new Map<string, DependencyInfo>();
  private outdatedCache = new Map<string, string>();
  private packageJson: PackageJson | null = null;
  private fileWatcher: fs.FSWatcher | null = null;
  private isLoading = false;

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

  // ============ File Watching ============

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
        this.parseDependencies();
      } else {
        this.packageJson = null;
        this.dependencies.clear();
      }
    } catch (error) {
      console.error('Failed to load package.json:', error);
      this.packageJson = null;
      this.dependencies.clear();
    }
  }

  private parseDependencies(): void {
    this.dependencies.clear();

    if (!this.packageJson) {
      return;
    }

    // Parse all dependency types
    this.addDependencies(this.packageJson.dependencies, 'dependency');
    this.addDependencies(this.packageJson.devDependencies, 'devDependency');
    this.addDependencies(this.packageJson.peerDependencies, 'peerDependency');
    this.addDependencies(this.packageJson.optionalDependencies, 'optionalDependency');
  }

  private addDependencies(
    deps: Record<string, string> | undefined,
    type: DependencyInfo['type']
  ): void {
    if (!deps) return;

    for (const [name, version] of Object.entries(deps)) {
      this.dependencies.set(name, {
        name,
        version,
        type,
        latestVersion: this.outdatedCache.get(name),
        outdated: this.outdatedCache.has(name) && this.outdatedCache.get(name) !== version,
      });
    }
  }

  // ============ Tree Data ============

  public getTreeItems(): DependencyTreeItem[] {
    if (!this.packageJson) {
      return [{
        id: 'no-package',
        label: 'No package.json found',
        description: 'Create a package.json to manage dependencies',
        icon: '$(info)',
      }];
    }

    if (this.dependencies.size === 0) {
      return [{
        id: 'no-deps',
        label: 'No dependencies',
        description: 'Add dependencies to get started',
        icon: '$(info)',
      }];
    }

    const items: DependencyTreeItem[] = [];

    // Group by type
    const groups: { type: DependencyInfo['type']; label: string; icon: string }[] = [
      { type: 'dependency', label: 'Dependencies', icon: '$(package)' },
      { type: 'devDependency', label: 'Dev Dependencies', icon: '$(tools)' },
      { type: 'peerDependency', label: 'Peer Dependencies', icon: '$(link)' },
      { type: 'optionalDependency', label: 'Optional Dependencies', icon: '$(question)' },
    ];

    for (const { type, label, icon } of groups) {
      const depsOfType = Array.from(this.dependencies.values())
        .filter(d => d.type === type)
        .sort((a, b) => a.name.localeCompare(b.name));

      if (depsOfType.length > 0) {
        const outdatedCount = depsOfType.filter(d => d.outdated).length;

        items.push({
          id: `group-${type}`,
          label,
          description: `${depsOfType.length}${outdatedCount > 0 ? ` (${outdatedCount} outdated)` : ''}`,
          icon,
          collapsible: true,
          children: depsOfType.map(dep => this.createDependencyItem(dep)),
        });
      }
    }

    return items;
  }

  private createDependencyItem(dep: DependencyInfo): DependencyTreeItem {
    const isOutdated = dep.outdated;
    const icon = isOutdated ? '$(warning)' : '$(check)';
    const color = isOutdated ? '#FFA500' : undefined;

    let tooltip = `${dep.name}@${dep.version}`;
    if (dep.latestVersion) {
      tooltip += `\nLatest: ${dep.latestVersion}`;
    }
    tooltip += `\nType: ${dep.type}`;

    return {
      id: `dep-${dep.name}`,
      label: dep.name,
      description: dep.version,
      tooltip,
      icon,
      dependency: dep,
      contextValue: 'dependency',
      command: 'web.openDependencyDetails',
    };
  }

  // ============ Outdated Check ============

  public async checkOutdated(): Promise<void> {
    if (this.isLoading) return;

    this.isLoading = true;
    this.emit('checking');

    const packageManager = this.config.detectPackageManager();
    const command = this.getOutdatedCommand(packageManager);

    return new Promise((resolve) => {
      const child = spawn(command.bin, command.args, {
        cwd: this.config.getWorkspaceRoot(),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', () => {
        try {
          this.parseOutdatedOutput(stdout, packageManager);
        } catch (error) {
          console.error('Failed to parse outdated output:', error);
        }

        this.isLoading = false;
        this.emit('checked');
        this.emit('refresh');
        resolve();
      });

      child.on('error', () => {
        this.isLoading = false;
        this.emit('checked');
        resolve();
      });
    });
  }

  private getOutdatedCommand(pm: string): { bin: string; args: string[] } {
    switch (pm) {
      case 'yarn':
        return { bin: 'yarn', args: ['outdated', '--json'] };
      case 'pnpm':
        return { bin: 'pnpm', args: ['outdated', '--json'] };
      case 'bun':
        return { bin: 'bun', args: ['outdated'] };
      case 'npm':
      default:
        return { bin: 'npm', args: ['outdated', '--json'] };
    }
  }

  private parseOutdatedOutput(output: string, pm: string): void {
    this.outdatedCache.clear();

    try {
      if (pm === 'npm' || pm === 'pnpm') {
        const parsed = JSON.parse(output);
        for (const [name, info] of Object.entries(parsed)) {
          const latest = (info as { latest?: string }).latest;
          if (latest) {
            this.outdatedCache.set(name, latest);
          }
        }
      } else if (pm === 'yarn') {
        // Yarn outputs lines of JSON
        const lines = output.trim().split('\n');
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'table' && parsed.data) {
              const body = parsed.data.body as string[][];
              for (const row of body) {
                const [name, , , latest] = row;
                if (latest) {
                  this.outdatedCache.set(name, latest);
                }
              }
            }
          } catch {
            // Skip invalid lines
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse outdated:', error);
    }

    // Update dependencies with latest versions
    for (const dep of this.dependencies.values()) {
      const latest = this.outdatedCache.get(dep.name);
      if (latest) {
        dep.latestVersion = latest;
        dep.outdated = latest !== dep.version;
      }
    }
  }

  // ============ Package Operations ============

  public async installPackage(
    name: string,
    version?: string,
    type: 'dependency' | 'devDependency' = 'dependency'
  ): Promise<boolean> {
    const packageManager = this.config.detectPackageManager();
    const command = this.getAddCommand(packageManager, name, version, type);

    return new Promise((resolve) => {
      this.emit('installing', name);

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
        this.emit('installOutput', { package: name, type: 'stdout', data: text });
      });

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        this.emit('installOutput', { package: name, type: 'stderr', data: text });
      });

      child.on('close', (code) => {
        this.emit('installed', { package: name, success: code === 0 });
        
        if (code === 0) {
          this.loadPackageJson();
          this.emit('refresh');
        }

        resolve(code === 0);
      });

      child.on('error', (error) => {
        this.emit('installed', { package: name, success: false, error });
        resolve(false);
      });
    });
  }

  public async installPackages(
    packages: string[],
    type: 'dependency' | 'devDependency' = 'dependency'
  ): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const pkg of packages) {
      const [name, version] = pkg.split('@');
      const result = await this.installPackage(name, version, type);
      
      if (result) {
        success.push(pkg);
      } else {
        failed.push(pkg);
      }
    }

    return { success, failed };
  }

  public async uninstallPackage(name: string): Promise<boolean> {
    const packageManager = this.config.detectPackageManager();
    const command = this.getRemoveCommand(packageManager, name);

    return new Promise((resolve) => {
      this.emit('uninstalling', name);

      const child = spawn(command.bin, command.args, {
        cwd: this.config.getWorkspaceRoot(),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      child.on('close', (code) => {
        this.emit('uninstalled', { package: name, success: code === 0 });
        
        if (code === 0) {
          this.dependencies.delete(name);
          this.loadPackageJson();
          this.emit('refresh');
        }

        resolve(code === 0);
      });

      child.on('error', () => {
        this.emit('uninstalled', { package: name, success: false });
        resolve(false);
      });
    });
  }

  public async updatePackage(name: string): Promise<boolean> {
    const packageManager = this.config.detectPackageManager();
    const command = this.getUpdateCommand(packageManager, name);

    return new Promise((resolve) => {
      this.emit('updating', name);

      const child = spawn(command.bin, command.args, {
        cwd: this.config.getWorkspaceRoot(),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      child.on('close', (code) => {
        this.emit('updated', { package: name, success: code === 0 });
        
        if (code === 0) {
          this.loadPackageJson();
          this.emit('refresh');
        }

        resolve(code === 0);
      });

      child.on('error', () => {
        this.emit('updated', { package: name, success: false });
        resolve(false);
      });
    });
  }

  private getAddCommand(
    pm: string,
    name: string,
    version?: string,
    type?: 'dependency' | 'devDependency'
  ): { bin: string; args: string[] } {
    const pkg = version ? `${name}@${version}` : name;
    const devFlag = type === 'devDependency' ? '--save-dev' : '--save';

    switch (pm) {
      case 'yarn':
        return {
          bin: 'yarn',
          args: ['add', pkg, ...(type === 'devDependency' ? ['--dev'] : [])],
        };
      case 'pnpm':
        return {
          bin: 'pnpm',
          args: ['add', pkg, ...(type === 'devDependency' ? ['--save-dev'] : [])],
        };
      case 'bun':
        return {
          bin: 'bun',
          args: ['add', pkg, ...(type === 'devDependency' ? ['--dev'] : [])],
        };
      case 'npm':
      default:
        return { bin: 'npm', args: ['install', pkg, devFlag] };
    }
  }

  private getRemoveCommand(pm: string, name: string): { bin: string; args: string[] } {
    switch (pm) {
      case 'yarn':
        return { bin: 'yarn', args: ['remove', name] };
      case 'pnpm':
        return { bin: 'pnpm', args: ['remove', name] };
      case 'bun':
        return { bin: 'bun', args: ['remove', name] };
      case 'npm':
      default:
        return { bin: 'npm', args: ['uninstall', name] };
    }
  }

  private getUpdateCommand(pm: string, name?: string): { bin: string; args: string[] } {
    const pkg = name || '';
    
    switch (pm) {
      case 'yarn':
        return { bin: 'yarn', args: ['upgrade', ...(pkg ? [pkg] : [])] };
      case 'pnpm':
        return { bin: 'pnpm', args: ['update', ...(pkg ? [pkg] : [])] };
      case 'bun':
        return { bin: 'bun', args: ['update', ...(pkg ? [pkg] : [])] };
      case 'npm':
      default:
        return { bin: 'npm', args: ['update', ...(pkg ? [pkg] : [])] };
    }
  }

  // ============ Public API ============

  public getDependencies(): DependencyInfo[] {
    return Array.from(this.dependencies.values());
  }

  public getDependency(name: string): DependencyInfo | undefined {
    return this.dependencies.get(name);
  }

  public isLoading(): boolean {
    return this.isLoading;
  }

  public refresh(): void {
    this.loadPackageJson();
    this.emit('refresh');
  }
}
