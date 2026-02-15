import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import { DEFAULT_JAVA_CONFIGURATION, JavaConfiguration } from '../languages/java/JavaConfig';

/**
 * Configuration Manager for Kimi IDE IDE
 * Manages all IDE settings with type-safe access
 */
export class ConfigManager extends EventEmitter {
  private static instance: ConfigManager;
  private config: Map<string, any> = new Map();
  private configPath: string = '';

  private constructor() {
    super();
    this.loadDefaults();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load default configurations
   */
  private loadDefaults(): void {
    // Load Java defaults
    for (const [key, value] of Object.entries(DEFAULT_JAVA_CONFIGURATION)) {
      this.config.set(key, value);
    }
  }

  /**
   * Load configuration from file
   */
  public async loadFromFile(filePath: string): Promise<void> {
    this.configPath = filePath;
    
    try {
      if (await fs.promises.access(filePath).then(() => true).catch(() => false)) {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        
        for (const [key, value] of Object.entries(parsed)) {
          this.config.set(key, value);
        }
        
        this.emit('loaded');
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Save configuration to file
   */
  public async saveToFile(filePath?: string): Promise<void> {
    const savePath = filePath || this.configPath;
    if (!savePath) return;

    try {
      const obj: Record<string, any> = {};
      for (const [key, value] of this.config) {
        obj[key] = value;
      }
      
      await fs.promises.mkdir(path.dirname(savePath), { recursive: true });
      await fs.promises.writeFile(savePath, JSON.stringify(obj, null, 2));
      
      this.emit('saved');
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Get configuration value
   */
  public get<T>(key: string, defaultValue?: T): T | undefined {
    return this.config.has(key) ? this.config.get(key) : defaultValue;
  }

  /**
   * Set configuration value
   */
  public set<T>(key: string, value: T): void {
    const oldValue = this.config.get(key);
    this.config.set(key, value);
    
    if (oldValue !== value) {
      this.emit('change', { key, value, oldValue });
      this.emit(`change:${key}`, value, oldValue);
    }
  }

  /**
   * Check if key exists
   */
  public has(key: string): boolean {
    return this.config.has(key);
  }

  /**
   * Delete configuration key
   */
  public delete(key: string): boolean {
    const had = this.config.delete(key);
    if (had) {
      this.emit('delete', { key });
    }
    return had;
  }

  /**
   * Get all configuration entries
   */
  public getAll(): Record<string, any> {
    const obj: Record<string, any> = {};
    for (const [key, value] of this.config) {
      obj[key] = value;
    }
    return obj;
  }

  /**
   * Update multiple values at once
   */
  public update(values: Record<string, any>): void {
    for (const [key, value] of Object.entries(values)) {
      this.set(key, value);
    }
  }

  /**
   * Reset to defaults
   */
  public reset(): void {
    this.config.clear();
    this.loadDefaults();
    this.emit('reset');
  }

  /**
   * Watch configuration file for changes
   */
  public watch(): void {
    if (!this.configPath) return;
    
    fs.watchFile(this.configPath, () => {
      this.loadFromFile(this.configPath);
      this.emit('externalChange');
    });
  }

  /**
   * Stop watching
   */
  public unwatch(): void {
    if (this.configPath) {
      fs.unwatchFile(this.configPath);
    }
  }
}
