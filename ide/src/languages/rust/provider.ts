/**
 * Rust Language Provider
 * Main class for Rust toolchain integration and cargo operations
 */

import { spawn, exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import {
  RustToolchainInfo,
  RustInstallationCheck,
  CargoCommand,
  CargoOptions,
  CargoResult,
  RustDiagnostic,
  RustCompletionItem,
  CompletionItemKind,
  CargoToml,
  RustConfiguration,
  DEFAULT_RUST_CONFIG,
} from './types';

const execAsync = promisify(exec);

export class RustLanguageProvider {
  private config: RustConfiguration;
  private workspaceRoot: string;
  private rustAnalyzerPath: string | null = null;
  private cargoTomlPath: string | null = null;

  constructor(workspaceRoot: string, config?: Partial<RustConfiguration>) {
    this.workspaceRoot = workspaceRoot;
    this.config = { ...DEFAULT_RUST_CONFIG, ...config };
    this.findCargoToml();
  }

  /**
   * Find Cargo.toml in workspace
   */
  private findCargoToml(): void {
    const possiblePaths = [
      path.join(this.workspaceRoot, 'Cargo.toml'),
      path.join(this.workspaceRoot, 'rust', 'Cargo.toml'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.cargoTomlPath = p;
        break;
      }
    }
  }

  /**
   * Check if Rust is installed and available
   */
  async checkRustInstallation(): Promise<RustInstallationCheck> {
    const result: RustInstallationCheck = {
      installed: false,
      rustup: false,
      cargo: false,
      rustc: false,
      rustfmt: false,
      rustAnalyzer: false,
      errors: [],
    };

    const checks = [
      { name: 'rustup', cmd: 'rustup --version' },
      { name: 'cargo', cmd: 'cargo --version' },
      { name: 'rustc', cmd: 'rustc --version' },
      { name: 'rustfmt', cmd: 'rustfmt --version' },
      { name: 'rustAnalyzer', cmd: 'rust-analyzer --version' },
    ];

    for (const check of checks) {
      try {
        await execAsync(check.cmd);
        (result as any)[check.name] = true;
      } catch (error) {
        (result as any)[check.name] = false;
        result.errors?.push(`${check.name} not found`);
      }
    }

    result.installed = result.rustup && result.cargo && result.rustc;
    return result;
  }

  /**
   * Get detailed toolchain information
   */
  async getToolchainInfo(): Promise<RustToolchainInfo | null> {
    try {
      const [versionOutput, hostOutput, defaultToolchain] = await Promise.all([
        execAsync('rustc --version --verbose'),
        execAsync('rustc --print host-triple'),
        execAsync('rustup default').catch(() => ({ stdout: 'stable' })),
      ]);

      const lines = versionOutput.stdout.split('\n');
      const info: Partial<RustToolchainInfo> = {
        toolchain: defaultToolchain.stdout.trim().split(' ')[0] || 'stable',
        target: hostOutput.stdout.trim(),
        host: hostOutput.stdout.trim(),
      };

      for (const line of lines) {
        if (line.startsWith('release:')) {
          info.version = line.split(':')[1].trim();
        } else if (line.startsWith('commit-hash:')) {
          info.commitHash = line.split(':')[1].trim();
        } else if (line.startsWith('commit-date:')) {
          info.commitDate = line.split(':')[1].trim();
        }
      }

      return info as RustToolchainInfo;
    } catch (error) {
      console.error('Failed to get toolchain info:', error);
      return null;
    }
  }

  /**
   * Run a cargo command with options
   */
  async runCargo(command: CargoCommand, options: CargoOptions = {}): Promise<CargoResult> {
    const args = this.buildCargoArgs(command, options);
    const cwd = this.cargoTomlPath ? path.dirname(this.cargoTomlPath) : this.workspaceRoot;
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';

      const child = spawn('cargo', args, {
        cwd,
        env: {
          ...process.env,
          RUST_BACKTRACE: options.verbose ? '1' : '0',
        },
      });

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (exitCode) => {
        resolve({
          success: exitCode === 0,
          stdout,
          stderr,
          exitCode: exitCode || 0,
          duration: Date.now() - startTime,
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          stdout,
          stderr: error.message,
          exitCode: -1,
          duration: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * Build cargo arguments from options
   */
  private buildCargoArgs(command: CargoCommand, options: CargoOptions): string[] {
    const args: string[] = [command];

    if (options.release && ['build', 'run', 'test'].includes(command)) {
      args.push('--release');
    }

    if (options.target) {
      args.push('--target', options.target);
    }

    if (options.package) {
      args.push('--package', options.package);
    }

    if (options.features && options.features.length > 0) {
      args.push('--features', options.features.join(','));
    }

    if (options.allFeatures) {
      args.push('--all-features');
    }

    if (options.noDefaultFeatures) {
      args.push('--no-default-features');
    }

    if (options.verbose) {
      args.push('--verbose');
    }

    // Add custom cargo args from config
    if (this.config.cargoArgs.length > 0) {
      args.push(...this.config.cargoArgs);
    }

    if (options.args) {
      if (['run', 'test'].includes(command)) {
        args.push('--');
      }
      args.push(...options.args);
    }

    return args;
  }

  /**
   * Get diagnostics via cargo check
   */
  async getDiagnostics(): Promise<RustDiagnostic[]> {
    try {
      const result = await this.runCargo('check', {
        ...this.buildConfigOptions(),
        verbose: true,
      });

      return this.parseDiagnostics(result.stderr || result.stdout);
    } catch (error) {
      console.error('Failed to get diagnostics:', error);
      return [];
    }
  }

  /**
   * Get diagnostics via clippy
   */
  async getClippyDiagnostics(): Promise<RustDiagnostic[]> {
    try {
      const result = await this.runCargo('clippy', {
        ...this.buildConfigOptions(),
        verbose: true,
      });

      return this.parseDiagnostics(result.stderr || result.stdout);
    } catch (error) {
      console.error('Failed to get clippy diagnostics:', error);
      return [];
    }
  }

  /**
   * Parse cargo/rustc output for diagnostics
   */
  private parseDiagnostics(output: string): RustDiagnostic[] {
    const diagnostics: RustDiagnostic[] = [];
    const lines = output.split('\n');
    
    // Regex patterns for different error formats
    const errorPattern = /^error\[?(E\d{4})?\]?:?\s*(.+)$/;
    const warningPattern = /^warning:\s*(.+)$/;
    const locationPattern = /^\s*-->\s+([^:]+):(\d+):(\d+)$/;
    const suggestionPattern = /^\s*=\s*help:\s*(.+)$/;

    let currentDiagnostic: Partial<RustDiagnostic> | null = null;

    for (const line of lines) {
      const errorMatch = line.match(errorPattern);
      if (errorMatch) {
        if (currentDiagnostic?.message) {
          diagnostics.push(currentDiagnostic as RustDiagnostic);
        }
        currentDiagnostic = {
          severity: 'error',
          code: errorMatch[1],
          message: errorMatch[2],
          file: '',
          line: 0,
          column: 0,
        };
        continue;
      }

      const warningMatch = line.match(warningPattern);
      if (warningMatch) {
        if (currentDiagnostic?.message) {
          diagnostics.push(currentDiagnostic as RustDiagnostic);
        }
        currentDiagnostic = {
          severity: 'warning',
          message: warningMatch[1],
          file: '',
          line: 0,
          column: 0,
        };
        continue;
      }

      const locationMatch = line.match(locationPattern);
      if (locationMatch && currentDiagnostic) {
        currentDiagnostic.file = locationMatch[1];
        currentDiagnostic.line = parseInt(locationMatch[2], 10);
        currentDiagnostic.column = parseInt(locationMatch[3], 10);
        continue;
      }

      const suggestionMatch = line.match(suggestionPattern);
      if (suggestionMatch && currentDiagnostic) {
        currentDiagnostic.suggestion = suggestionMatch[1];
        continue;
      }
    }

    if (currentDiagnostic?.message) {
      diagnostics.push(currentDiagnostic as RustDiagnostic);
    }

    return diagnostics;
  }

  /**
   * Format code using rustfmt
   */
  async formatCode(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const { stdout, stderr } = await execAsync(`rustfmt --emit stdout "${filePath}"`);
      
      if (stderr) {
        // rustfmt outputs warnings to stderr, but may still succeed
        console.warn('rustfmt warnings:', stderr);
      }

      return {
        success: true,
        content: stdout || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Format code inline using rustfmt
   */
  async formatCodeString(code: string): Promise<{ success: boolean; content?: string; error?: string }> {
    return new Promise((resolve) => {
      try {
        const child = spawn('rustfmt', ['--emit', 'stdout'], {
          env: process.env,
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (exitCode) => {
          if (exitCode === 0) {
            resolve({
              success: true,
              content: stdout,
            });
          } else {
            resolve({
              success: false,
              error: stderr || 'rustfmt failed',
            });
          }
        });

        child.on('error', (error) => {
          resolve({
            success: false,
            error: error.message,
          });
        });

        // Write code to stdin
        child.stdin?.write(code);
        child.stdin?.end();
      } catch (error) {
        resolve({
          success: false,
          error: (error as Error).message,
        });
      }
    });
  }

  /**
   * Get completions using rust-analyzer
   */
  async getCompletions(
    filePath: string,
    line: number,
    column: number
  ): Promise<RustCompletionItem[]> {
    if (!this.rustAnalyzerPath) {
      // Try to find rust-analyzer
      try {
        await execAsync('rust-analyzer --version');
        this.rustAnalyzerPath = 'rust-analyzer';
      } catch {
        return this.getFallbackCompletions();
      }
    }

    // Basic implementation using rust-analyzer CLI
    // For full LSP support, consider integrating with vscode-jsonrpc
    try {
      // This is a simplified version - full LSP integration would require
      // setting up a proper LSP client connection
      return this.getFallbackCompletions();
    } catch (error) {
      console.error('Failed to get completions:', error);
      return this.getFallbackCompletions();
    }
  }

  /**
   * Fallback completions for when rust-analyzer is not available
   */
  private getFallbackCompletions(): RustCompletionItem[] {
    const keywords = [
      'fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'trait',
      'impl', 'pub', 'use', 'mod', 'match', 'if', 'else', 'while', 'for',
      'loop', 'return', 'break', 'continue', 'async', 'await', 'move',
      'where', 'type', 'ref', 'self', 'Self', 'super', 'crate', 'in',
    ];

    const types = [
      'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
      'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
      'f32', 'f64', 'bool', 'char', 'str', 'String',
      'Vec', 'Option', 'Result', 'Box', 'Rc', 'Arc',
      'HashMap', 'HashSet', 'BTreeMap', 'BTreeSet',
    ];

    const macros = [
      'println!', 'print!', 'format!', 'vec!', 'vec',
      'option!', 'result!', 'panic!', 'assert!', 'assert_eq!',
      'assert_ne!', 'debug_assert!', 'todo!', 'unimplemented!',
    ];

    const items: RustCompletionItem[] = [
      ...keywords.map(k => ({ label: k, kind: 'keyword' as CompletionItemKind })),
      ...types.map(t => ({ label: t, kind: 'struct' as CompletionItemKind, detail: 'primitive type' })),
      ...macros.map(m => ({ label: m, kind: 'function' as CompletionItemKind, detail: 'macro' })),
    ];
    return items;
  }

  /**
   * Parse Cargo.toml file
   */
  parseCargoToml(): CargoToml | null {
    if (!this.cargoTomlPath || !fs.existsSync(this.cargoTomlPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.cargoTomlPath, 'utf-8');
      return this.parseToml(content);
    } catch (error) {
      console.error('Failed to parse Cargo.toml:', error);
      return null;
    }
  }

  /**
   * Simple TOML parser for Cargo.toml
   */
  private parseToml(content: string): CargoToml {
    const result: CargoToml = {};
    let currentSection: string | null = null;
    let currentObject: any = {};

    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Section header
      if (trimmed.startsWith('[')) {
        if (currentSection) {
          this.assignSection(result, currentSection, currentObject);
        }
        currentSection = trimmed.slice(1, -1).trim();
        currentObject = {};
        continue;
      }

      // Key-value pair
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.slice(0, equalIndex).trim();
        let value = trimmed.slice(equalIndex + 1).trim();

        // Remove quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        // Parse arrays
        if (value.startsWith('[') && value.endsWith(']')) {
          try {
            value = JSON.parse(value.replace(/'/g, '"'));
          } catch {
            // Keep as string if parsing fails
          }
        }

        currentObject[key] = value;
      }
    }

    if (currentSection) {
      this.assignSection(result, currentSection, currentObject);
    }

    return result;
  }

  /**
   * Assign parsed section to result object
   */
  private assignSection(result: CargoToml, section: string, obj: any): void {
    if (section === 'package') {
      result.package = obj;
    } else if (section === 'dependencies') {
      result.dependencies = obj;
    } else if (section === 'dev-dependencies') {
      result['dev-dependencies'] = obj;
    } else if (section === 'features') {
      result.features = obj;
    } else if (section === 'workspace') {
      result.workspace = obj;
    } else if (section === 'lib') {
      result.lib = obj;
    } else if (section.startsWith('bin')) {
      if (!result.bin) result.bin = [];
      result.bin.push(obj);
    }
  }

  /**
   * Get dependencies from Cargo.toml
   */
  getDependencies(): Array<{ name: string; version: string; isDev: boolean }> {
    const cargoToml = this.parseCargoToml();
    if (!cargoToml) return [];

    const deps: Array<{ name: string; version: string; isDev: boolean }> = [];

    if (cargoToml.dependencies) {
      for (const [name, value] of Object.entries(cargoToml.dependencies)) {
        const version = typeof value === 'string' ? value : value.version || '?';
        deps.push({ name, version, isDev: false });
      }
    }

    if (cargoToml['dev-dependencies']) {
      for (const [name, value] of Object.entries(cargoToml['dev-dependencies'])) {
        const version = typeof value === 'string' ? value : value.version || '?';
        deps.push({ name, version, isDev: true });
      }
    }

    return deps;
  }

  /**
   * Update dependencies via cargo update
   */
  async updateDependencies(): Promise<CargoResult> {
    return this.runCargo('update', {});
  }

  /**
   * Build configuration options from current config
   */
  private buildConfigOptions(): CargoOptions {
    return {
      target: this.config.target || undefined,
      features: this.config.features.length > 0 ? this.config.features : undefined,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RustConfiguration>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RustConfiguration {
    return { ...this.config };
  }

  /**
   * Check if current workspace is a Rust project
   */
  isRustProject(): boolean {
    return this.cargoTomlPath !== null && fs.existsSync(this.cargoTomlPath);
  }

  /**
   * Get project name from Cargo.toml
   */
  getProjectName(): string | null {
    const cargoToml = this.parseCargoToml();
    return cargoToml?.package?.name || null;
  }

  /**
   * Get available features from Cargo.toml
   */
  getAvailableFeatures(): string[] {
    const cargoToml = this.parseCargoToml();
    return cargoToml?.features ? Object.keys(cargoToml.features) : [];
  }
}

// Singleton instance
let providerInstance: RustLanguageProvider | null = null;

export function getRustProvider(workspaceRoot: string): RustLanguageProvider {
  if (!providerInstance || providerInstance['workspaceRoot'] !== workspaceRoot) {
    providerInstance = new RustLanguageProvider(workspaceRoot);
  }
  return providerInstance;
}

export function setRustProvider(provider: RustLanguageProvider): void {
  providerInstance = provider;
}
