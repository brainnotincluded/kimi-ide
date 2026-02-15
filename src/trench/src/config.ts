/**
 * Trench CLI - Configuration Management
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { TrenchConfig, ApiKeys, DefaultSettings, CacheSettings, OutputSettings, McpSettings } from './types/index.js';

const CONFIG_VERSION = '1.0.0';
const CONFIG_FILENAME = 'trench.config.json';

// Default configuration
const defaultConfig: TrenchConfig = {
  version: CONFIG_VERSION,
  apiKeys: {},
  defaults: {
    searchProvider: 'duckduckgo',
    outputFormat: 'markdown',
    maxResults: 10,
    researchDepth: 'standard',
    language: 'en',
  },
  cache: {
    enabled: true,
    directory: path.join(os.homedir(), '.trench', 'cache'),
    defaultTtl: 3600, // 1 hour
    maxSize: 100 * 1024 * 1024, // 100MB
    compression: true,
  },
  output: {
    colors: true,
    pager: false,
    maxWidth: 120,
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
  },
  mcp: {
    enabled: false,
    port: 3456,
    host: 'localhost',
    allowedOrigins: ['localhost', '127.0.0.1'],
  },
};

/**
 * Configuration manager class
 */
export class ConfigManager {
  private configPath: string;
  private config: TrenchConfig;
  private loaded: boolean = false;

  constructor(customPath?: string) {
    this.configPath = customPath || this.getDefaultConfigPath();
    this.config = { ...defaultConfig };
  }

  /**
   * Get default config path based on OS
   */
  private getDefaultConfigPath(): string {
    const homeDir = os.homedir();
    
    switch (process.platform) {
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'trench', CONFIG_FILENAME);
      case 'win32':
        return path.join(homeDir, 'AppData', 'Roaming', 'trench', CONFIG_FILENAME);
      default: // linux and others
        return path.join(homeDir, '.config', 'trench', CONFIG_FILENAME);
    }
  }

  /**
   * Load configuration from file
   */
  async load(): Promise<TrenchConfig> {
    try {
      await this.ensureConfigDir();
      
      const data = await fs.readFile(this.configPath, 'utf-8');
      const loaded = JSON.parse(data) as Partial<TrenchConfig>;
      
      // Merge with defaults for any missing fields
      this.config = this.mergeConfig(defaultConfig, loaded);
      this.loaded = true;
      
      return this.config;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Config doesn't exist, create with defaults
        await this.save();
        this.loaded = true;
        return this.config;
      }
      throw error;
    }
  }

  /**
   * Save current configuration to file
   */
  async save(): Promise<void> {
    await this.ensureConfigDir();
    await fs.writeFile(
      this.configPath,
      JSON.stringify(this.config, null, 2),
      'utf-8'
    );
  }

  /**
   * Ensure config directory exists
   */
  private async ensureConfigDir(): Promise<void> {
    const dir = path.dirname(this.configPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    // Also ensure cache directory exists
    try {
      await fs.mkdir(this.config.cache.directory, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Merge loaded config with defaults
   */
  private mergeConfig(defaults: TrenchConfig, loaded: Partial<TrenchConfig>): TrenchConfig {
    return {
      version: loaded.version || defaults.version,
      apiKeys: { ...defaults.apiKeys, ...loaded.apiKeys },
      defaults: { ...defaults.defaults, ...loaded.defaults },
      cache: { ...defaults.cache, ...loaded.cache },
      output: { ...defaults.output, ...loaded.output },
      mcp: { ...defaults.mcp, ...loaded.mcp },
    };
  }

  /**
   * Get current configuration
   */
  get(): TrenchConfig {
    if (!this.loaded) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Get specific API key
   */
  getApiKey(service: keyof ApiKeys): string | undefined {
    // First check environment variables
    const envVar = `TRENCH_${service.toUpperCase()}_API_KEY`;
    const envValue = process.env[envVar];
    if (envValue) return envValue;
    
    // Fall back to config file
    return this.config.apiKeys[service];
  }

  /**
   * Set API key
   */
  async setApiKey(service: keyof ApiKeys, key: string): Promise<void> {
    this.config.apiKeys[service] = key;
    await this.save();
  }

  /**
   * Get default settings
   */
  getDefaults(): DefaultSettings {
    return this.config.defaults;
  }

  /**
   * Update default settings
   */
  async updateDefaults(settings: Partial<DefaultSettings>): Promise<void> {
    this.config.defaults = { ...this.config.defaults, ...settings };
    await this.save();
  }

  /**
   * Get cache settings
   */
  getCacheSettings(): CacheSettings {
    return this.config.cache;
  }

  /**
   * Update cache settings
   */
  async updateCacheSettings(settings: Partial<CacheSettings>): Promise<void> {
    this.config.cache = { ...this.config.cache, ...settings };
    await this.save();
  }

  /**
   * Get output settings
   */
  getOutputSettings(): OutputSettings {
    return this.config.output;
  }

  /**
   * Update output settings
   */
  async updateOutputSettings(settings: Partial<OutputSettings>): Promise<void> {
    this.config.output = { ...this.config.output, ...settings };
    await this.save();
  }

  /**
   * Get MCP settings
   */
  getMcpSettings(): McpSettings {
    return this.config.mcp;
  }

  /**
   * Update MCP settings
   */
  async updateMcpSettings(settings: Partial<McpSettings>): Promise<void> {
    this.config.mcp = { ...this.config.mcp, ...settings };
    await this.save();
  }

  /**
   * Reset configuration to defaults
   */
  async reset(): Promise<void> {
    this.config = { ...defaultConfig };
    await this.save();
  }

  /**
   * Get config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Check if configuration is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Validate configuration
   */
  validate(): string[] {
    const errors: string[] = [];
    
    // Check required fields
    if (!this.config.version) {
      errors.push('Missing version');
    }
    
    // Validate cache settings
    if (this.config.cache.maxSize < 1024 * 1024) {
      errors.push('Cache max size must be at least 1MB');
    }
    
    if (this.config.cache.defaultTtl < 60) {
      errors.push('Cache TTL must be at least 60 seconds');
    }
    
    // Validate MCP settings
    if (this.config.mcp.port < 1024 || this.config.mcp.port > 65535) {
      errors.push('MCP port must be between 1024 and 65535');
    }
    
    return errors;
  }

  /**
   * Export configuration (for backup)
   */
  async export(exportPath: string): Promise<void> {
    await fs.writeFile(
      exportPath,
      JSON.stringify(this.config, null, 2),
      'utf-8'
    );
  }

  /**
   * Import configuration
   */
  async import(importPath: string): Promise<void> {
    const data = await fs.readFile(importPath, 'utf-8');
    const imported = JSON.parse(data) as Partial<TrenchConfig>;
    this.config = this.mergeConfig(defaultConfig, imported);
    await this.save();
  }
}

// Singleton instance
let globalConfigManager: ConfigManager | null = null;

/**
 * Get global config manager instance
 */
export function getConfigManager(customPath?: string): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager(customPath);
  }
  return globalConfigManager;
}

/**
 * Initialize configuration
 */
export async function initConfig(customPath?: string): Promise<TrenchConfig> {
  const manager = getConfigManager(customPath);
  return await manager.load();
}

export { defaultConfig, CONFIG_VERSION };
