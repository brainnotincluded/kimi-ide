/**
 * Rust Language Support Configuration
 * Configuration management for Rust toolchain settings
 */

import { RustConfiguration, DEFAULT_RUST_CONFIG } from './types';
import * as path from 'path';
import * as fs from 'fs';

const CONFIG_FILE_NAME = 'traitor-rust.json';

/**
 * Configuration manager for Rust language support
 */
export class RustConfigManager {
  private config: RustConfiguration;
  private configPath: string;

  constructor(workspaceRoot: string) {
    this.configPath = path.join(workspaceRoot, '.traitor', CONFIG_FILE_NAME);
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from file or use defaults
   */
  private loadConfig(): RustConfiguration {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const saved = JSON.parse(content);
        return { ...DEFAULT_RUST_CONFIG, ...saved };
      }
    } catch (error) {
      console.error('Failed to load Rust config:', error);
    }
    return { ...DEFAULT_RUST_CONFIG };
  }

  /**
   * Save configuration to file
   */
  saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save Rust config:', error);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): RustConfiguration {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<RustConfiguration>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  /**
   * Set toolchain
   */
  setToolchain(toolchain: 'stable' | 'nightly' | 'beta'): void {
    this.config.toolchain = toolchain;
    this.saveConfig();
  }

  /**
   * Set target triple
   */
  setTarget(target: string): void {
    this.config.target = target;
    this.saveConfig();
  }

  /**
   * Set features
   */
  setFeatures(features: string[]): void {
    this.config.features = features;
    this.saveConfig();
  }

  /**
   * Add feature
   */
  addFeature(feature: string): void {
    if (!this.config.features.includes(feature)) {
      this.config.features.push(feature);
      this.saveConfig();
    }
  }

  /**
   * Remove feature
   */
  removeFeature(feature: string): void {
    this.config.features = this.config.features.filter(f => f !== feature);
    this.saveConfig();
  }

  /**
   * Set additional cargo arguments
   */
  setCargoArgs(args: string[]): void {
    this.config.cargoArgs = args;
    this.saveConfig();
  }

  /**
   * Enable/disable rustfmt on save
   */
  setRustfmtOnSave(enabled: boolean): void {
    this.config.rustfmtOnSave = enabled;
    this.saveConfig();
  }

  /**
   * Enable/disable check on save
   */
  setCheckOnSave(enabled: boolean): void {
    this.config.checkOnSave = enabled;
    this.saveConfig();
  }

  /**
   * Enable/disable clippy on save
   */
  setClippyOnSave(enabled: boolean): void {
    this.config.clippyOnSave = enabled;
    this.saveConfig();
  }

  /**
   * Reset to default configuration
   */
  resetToDefaults(): void {
    this.config = { ...DEFAULT_RUST_CONFIG };
    this.saveConfig();
  }

  /**
   * Get available targets
   */
  async getAvailableTargets(): Promise<string[]> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('rustup target list --installed');
      return stdout.split('\n').filter((t: string) => t.trim());
    } catch {
      return [];
    }
  }

  /**
   * Get available toolchains
   */
  async getAvailableToolchains(): Promise<string[]> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('rustup toolchain list');
      return stdout.split('\n')
        .filter((t: string) => t.trim())
        .map((t: string) => t.split(' ')[0]);
    } catch {
      return ['stable'];
    }
  }
}

// Global config manager instance
const configManagers = new Map<string, RustConfigManager>();

/**
 * Get or create config manager for workspace
 */
export function getConfigManager(workspaceRoot: string): RustConfigManager {
  if (!configManagers.has(workspaceRoot)) {
    configManagers.set(workspaceRoot, new RustConfigManager(workspaceRoot));
  }
  return configManagers.get(workspaceRoot)!;
}

/**
 * Cleanup config managers
 */
export function cleanupConfigManagers(): void {
  configManagers.clear();
}
