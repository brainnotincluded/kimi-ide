/**
 * Language Configuration - Configuration schema and management for languages
 * IDE Kimi IDE - Language Support Framework
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for a specific language
 */
export interface LanguageConfiguration {
    /** Whether the language support is enabled */
    enabled: boolean;
    /** Path to the language server executable */
    executable?: string;
    /** Arguments for the language server */
    args?: string[];
    /** Additional language-specific options */
    [key: string]: any;
}

/**
 * Configuration for the language support system
 */
export interface LanguageSupportConfiguration {
    /** Global settings for all languages */
    global?: {
        /** Default validation delay in milliseconds */
        validationDelay?: number;
        /** Whether to validate on change */
        validateOnChange?: boolean;
        /** Whether to validate on save */
        validateOnSave?: boolean;
        /** Whether to validate on type */
        validateOnType?: boolean;
        /** Default formatting options */
        format?: {
            tabSize?: number;
            insertSpaces?: boolean;
            trimTrailingWhitespace?: boolean;
            insertFinalNewline?: boolean;
            trimFinalNewlines?: boolean;
        };
    };
    /** Per-language configurations */
    languages: {
        [languageId: string]: LanguageConfiguration;
    };
}

// ============================================================================
// Configuration Schema
// ============================================================================

/**
 * JSON Schema for language configuration
 * Used for validation and IDE integration
 */
export const LanguageConfigurationSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'IDE Kimi IDE Language Configuration',
    description: 'Configuration for language support in IDE Kimi IDE',
    type: 'object',
    properties: {
        global: {
            type: 'object',
            description: 'Global settings for all languages',
            properties: {
                validationDelay: {
                    type: 'number',
                    description: 'Delay in milliseconds before running validation',
                    default: 500,
                    minimum: 0,
                    maximum: 5000
                },
                validateOnChange: {
                    type: 'boolean',
                    description: 'Whether to validate documents on change',
                    default: true
                },
                validateOnSave: {
                    type: 'boolean',
                    description: 'Whether to validate documents on save',
                    default: true
                },
                validateOnType: {
                    type: 'boolean',
                    description: 'Whether to validate documents while typing',
                    default: false
                },
                format: {
                    type: 'object',
                    description: 'Default formatting options',
                    properties: {
                        tabSize: {
                            type: 'number',
                            description: 'Number of spaces per tab',
                            default: 4,
                            minimum: 1,
                            maximum: 8
                        },
                        insertSpaces: {
                            type: 'boolean',
                            description: 'Use spaces instead of tabs',
                            default: true
                        },
                        trimTrailingWhitespace: {
                            type: 'boolean',
                            description: 'Trim trailing whitespace on save',
                            default: false
                        },
                        insertFinalNewline: {
                            type: 'boolean',
                            description: 'Insert final newline on save',
                            default: false
                        },
                        trimFinalNewlines: {
                            type: 'boolean',
                            description: 'Trim final newlines on save',
                            default: false
                        }
                    }
                }
            }
        },
        languages: {
            type: 'object',
            description: 'Per-language configurations',
            additionalProperties: {
                type: 'object',
                description: 'Configuration for a specific language',
                required: ['enabled'],
                properties: {
                    enabled: {
                        type: 'boolean',
                        description: 'Whether language support is enabled',
                        default: true
                    },
                    executable: {
                        type: 'string',
                        description: 'Path to the language server executable'
                    },
                    args: {
                        type: 'array',
                        description: 'Arguments for the language server',
                        items: {
                            type: 'string'
                        },
                        default: []
                    }
                },
                additionalProperties: true
            }
        }
    },
    required: ['languages']
};

// ============================================================================
// Configuration Manager
// ============================================================================

import { EventEmitter, Disposable } from './types';

export interface ConfigurationChangeEvent {
    /** The key that changed (e.g., 'languages.typescript.enabled') */
    key: string;
    /** The new value */
    value: any;
    /** The previous value */
    previousValue: any;
    /** The affected language ID (if applicable) */
    languageId?: string;
}

/**
 * Configuration Manager for language support
 * 
 * Manages configuration for language providers with support for
 * default values, type checking, and change events.
 * 
 * @example
 * ```typescript
 * const config = new LanguageConfigurationManager();
 * 
 * // Set configuration
 * config.set('languages.typescript.enabled', true);
 * config.set('languages.typescript.executable', 'typescript-language-server');
 * config.set('languages.typescript.args', ['--stdio']);
 * 
 * // Get configuration
 * const tsConfig = config.getLanguageConfig('typescript');
 * console.log(tsConfig.enabled); // true
 * 
 * // Listen for changes
 * config.onDidChange(({ key, value }) => {
 *   console.log(`Config ${key} changed to ${value}`);
 * });
 * ```
 */
export class LanguageConfigurationManager implements Disposable {
    private config: Map<string, any> = new Map();
    private defaults: Map<string, any> = new Map();
    private onDidChangeEmitter = new EventEmitter<ConfigurationChangeEvent>();

    /**
     * Create a new ConfigurationManager with optional initial config
     * @param initialConfig - Initial configuration values
     */
    constructor(initialConfig: Partial<LanguageSupportConfiguration> = {}) {
        this.initializeDefaults();
        this.loadConfiguration(initialConfig);
    }

    // ============================================================================
    // Configuration Access
    // ============================================================================

    /**
     * Get a configuration value
     * @param key - Configuration key (dot notation, e.g., 'languages.typescript.enabled')
     * @param defaultValue - Default value if not set
     * @returns The configuration value
     * 
     * @example
     * ```typescript
     * const enabled = config.get('languages.typescript.enabled', true);
     * const args = config.get('languages.typescript.args', []);
     * ```
     */
    get<T>(key: string, defaultValue?: T): T | undefined {
        const value = this.getNestedValue(this.config, key);
        if (value !== undefined) {
            return value;
        }
        
        const defaultConfig = this.getNestedValue(this.defaults, key);
        if (defaultConfig !== undefined) {
            return defaultConfig;
        }
        
        return defaultValue;
    }

    /**
     * Set a configuration value
     * @param key - Configuration key (dot notation)
     * @param value - Value to set
     * @returns true if the value changed
     * 
     * @example
     * ```typescript
     * config.set('languages.typescript.enabled', false);
     * config.set('languages.rust.executable', '/usr/bin/rust-analyzer');
     * ```
     */
    set<T>(key: string, value: T): boolean {
        const previousValue = this.get(key);
        
        if (previousValue === value) {
            return false;
        }

        this.setNestedValue(this.config, key, value);
        
        // Extract language ID from key if applicable
        const languageId = this.extractLanguageId(key);
        
        this.onDidChangeEmitter.emit({
            key,
            value,
            previousValue,
            languageId
        });

        return true;
    }

    /**
     * Check if a configuration key exists
     * @param key - Configuration key
     */
    has(key: string): boolean {
        return this.getNestedValue(this.config, key) !== undefined ||
               this.getNestedValue(this.defaults, key) !== undefined;
    }

    /**
     * Delete a configuration key
     * @param key - Configuration key
     * @returns true if the key was deleted
     */
    delete(key: string): boolean {
        const previousValue = this.get(key);
        const deleted = this.deleteNestedValue(this.config, key);
        
        if (deleted) {
            const languageId = this.extractLanguageId(key);
            this.onDidChangeEmitter.emit({
                key,
                value: undefined,
                previousValue,
                languageId
            });
        }

        return deleted;
    }

    // ============================================================================
    // Language-specific Configuration
    // ============================================================================

    /**
     * Get configuration for a specific language
     * @param languageId - Language identifier
     * @returns Language configuration
     */
    getLanguageConfig(languageId: string): LanguageConfiguration {
        const prefix = `languages.${languageId}`;
        
        return {
            enabled: this.get<boolean>(`${prefix}.enabled`, true)!,
            executable: this.get<string>(`${prefix}.executable`),
            args: this.get<string[]>(`${prefix}.args`, [])!,
            ...this.getLanguageSpecificOptions(languageId)
        };
    }

    /**
     * Set configuration for a specific language
     * @param languageId - Language identifier
     * @param config - Language configuration
     */
    setLanguageConfig(languageId: string, config: Partial<LanguageConfiguration>): void {
        const prefix = `languages.${languageId}`;
        
        if (config.enabled !== undefined) {
            this.set(`${prefix}.enabled`, config.enabled);
        }
        if (config.executable !== undefined) {
            this.set(`${prefix}.executable`, config.executable);
        }
        if (config.args !== undefined) {
            this.set(`${prefix}.args`, config.args);
        }
        
        // Set any additional options
        for (const [key, value] of Object.entries(config)) {
            if (!['enabled', 'executable', 'args'].includes(key)) {
                this.set(`${prefix}.${key}`, value);
            }
        }
    }

    /**
     * Check if a language is enabled
     * @param languageId - Language identifier
     */
    isLanguageEnabled(languageId: string): boolean {
        return this.get<boolean>(`languages.${languageId}.enabled`, true) ?? true;
    }

    /**
     * Enable a language
     * @param languageId - Language identifier
     */
    enableLanguage(languageId: string): void {
        this.set(`languages.${languageId}.enabled`, true);
    }

    /**
     * Disable a language
     * @param languageId - Language identifier
     */
    disableLanguage(languageId: string): void {
        this.set(`languages.${languageId}.enabled`, false);
    }

    /**
     * Get the executable path for a language
     * @param languageId - Language identifier
     */
    getExecutable(languageId: string): string | undefined {
        return this.get(`languages.${languageId}.executable`);
    }

    /**
     * Set the executable path for a language
     * @param languageId - Language identifier
     * @param executable - Path to the executable
     */
    setExecutable(languageId: string, executable: string): void {
        this.set(`languages.${languageId}.executable`, executable);
    }

    /**
     * Get the arguments for a language server
     * @param languageId - Language identifier
     */
    getArgs(languageId: string): string[] {
        return this.get<string[]>(`languages.${languageId}.args`, []) ?? [];
    }

    /**
     * Set the arguments for a language server
     * @param languageId - Language identifier
     * @param args - Arguments array
     */
    setArgs(languageId: string, args: string[]): void {
        this.set(`languages.${languageId}.args`, args);
    }

    // ============================================================================
    // Global Configuration
    // ============================================================================

    /**
     * Get global configuration value
     * @param key - Key within global section (e.g., 'validationDelay')
     * @param defaultValue - Default value
     */
    getGlobal<T>(key: string, defaultValue?: T): T | undefined {
        return this.get(`global.${key}`, defaultValue);
    }

    /**
     * Set global configuration value
     * @param key - Key within global section
     * @param value - Value to set
     */
    setGlobal<T>(key: string, value: T): void {
        this.set(`global.${key}`, value);
    }

    /**
     * Get formatting configuration
     */
    getFormatConfig() {
        return {
            tabSize: this.getGlobal('format.tabSize', 4),
            insertSpaces: this.getGlobal('format.insertSpaces', true),
            trimTrailingWhitespace: this.getGlobal('format.trimTrailingWhitespace', false),
            insertFinalNewline: this.getGlobal('format.insertFinalNewline', false),
            trimFinalNewlines: this.getGlobal('format.trimFinalNewlines', false)
        };
    }

    /**
     * Get validation configuration
     */
    getValidationConfig() {
        return {
            delay: this.getGlobal('validationDelay', 500),
            validateOnChange: this.getGlobal('validateOnChange', true),
            validateOnSave: this.getGlobal('validateOnSave', true),
            validateOnType: this.getGlobal('validateOnType', false)
        };
    }

    // ============================================================================
    // Configuration Loading/Saving
    // ============================================================================

    /**
     * Load configuration from an object
     * @param config - Configuration object
     */
    loadConfiguration(config: Partial<LanguageSupportConfiguration>): void {
        if (config.global) {
            for (const [key, value] of Object.entries(config.global)) {
                this.set(`global.${key}`, value);
            }
        }
        
        if (config.languages) {
            for (const [languageId, langConfig] of Object.entries(config.languages)) {
                this.setLanguageConfig(languageId, langConfig);
            }
        }
    }

    /**
     * Export configuration to an object
     */
    exportConfiguration(): LanguageSupportConfiguration {
        const result: LanguageSupportConfiguration = {
            languages: {}
        };

        // Export global config
        const globalConfig: any = {};
        for (const [key, value] of this.config.entries()) {
            if (key.startsWith('global.')) {
                const globalKey = key.substring(7);
                this.setNestedValue(globalConfig, globalKey, value);
            }
        }
        if (Object.keys(globalConfig).length > 0) {
            result.global = globalConfig;
        }

        // Export language configs
        const languageIds = this.getConfiguredLanguageIds();
        for (const languageId of languageIds) {
            result.languages[languageId] = this.getLanguageConfig(languageId);
        }

        return result;
    }

    /**
     * Get all configured language IDs
     */
    getConfiguredLanguageIds(): string[] {
        const ids = new Set<string>();
        
        for (const key of this.config.keys()) {
            const match = key.match(/^languages\.([^.]+)/);
            if (match) {
                ids.add(match[1]);
            }
        }
        
        return Array.from(ids);
    }

    // ============================================================================
    // Events
    // ============================================================================

    /**
     * Event fired when configuration changes
     */
    get onDidChange(): EventEmitter<ConfigurationChangeEvent> {
        return this.onDidChangeEmitter;
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    private initializeDefaults(): void {
        // Global defaults
        this.defaults.set('global.validationDelay', 500);
        this.defaults.set('global.validateOnChange', true);
        this.defaults.set('global.validateOnSave', true);
        this.defaults.set('global.validateOnType', false);
        this.defaults.set('global.format.tabSize', 4);
        this.defaults.set('global.format.insertSpaces', true);
        this.defaults.set('global.format.trimTrailingWhitespace', false);
        this.defaults.set('global.format.insertFinalNewline', false);
        this.defaults.set('global.format.trimFinalNewlines', false);
    }

    private getNestedValue(map: Map<string, any>, key: string): any {
        const keys = key.split('.');
        let current: any = Object.fromEntries(map);
        
        for (const k of keys) {
            if (current === undefined || current === null) {
                return undefined;
            }
            current = current[k];
        }
        
        return current;
    }

    private setNestedValue(map: Map<string, any>, key: string, value: any): void {
        const keys = key.split('.');
        const lastKey = keys.pop()!;
        
        // Build nested structure
        let current = map;
        for (const k of keys) {
            if (!current.has(k)) {
                current.set(k, new Map());
            }
            const next = current.get(k);
            if (!(next instanceof Map)) {
                const newMap = new Map();
                // Copy existing properties if it's an object
                if (typeof next === 'object' && next !== null) {
                    for (const [prop, val] of Object.entries(next)) {
                        newMap.set(prop, val);
                    }
                }
                current.set(k, newMap);
            }
            current = current.get(k);
        }
        
        current.set(lastKey, value);
    }

    private deleteNestedValue(map: Map<string, any>, key: string): boolean {
        const keys = key.split('.');
        const lastKey = keys.pop()!;
        
        let current: any = map;
        for (const k of keys) {
            if (!(current instanceof Map) || !current.has(k)) {
                return false;
            }
            current = current.get(k);
        }
        
        if (current instanceof Map) {
            return current.delete(lastKey);
        }
        
        return false;
    }

    private extractLanguageId(key: string): string | undefined {
        const match = key.match(/^languages\.([^.]+)/);
        return match ? match[1] : undefined;
    }

    private getLanguageSpecificOptions(languageId: string): Record<string, any> {
        const prefix = `languages.${languageId}`;
        const options: Record<string, any> = {};
        
        for (const [key, value] of this.config.entries()) {
            if (key.startsWith(prefix + '.') && 
                !key.startsWith(prefix + '.enabled') &&
                !key.startsWith(prefix + '.executable') &&
                !key.startsWith(prefix + '.args')) {
                const optionKey = key.substring(prefix.length + 1);
                options[optionKey] = value;
            }
        }
        
        return options;
    }

    /**
     * Dispose of the configuration manager
     */
    dispose(): void {
        this.config.clear();
        this.defaults.clear();
        this.onDidChangeEmitter.dispose();
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a default configuration for a language
 */
export function createDefaultLanguageConfig(
    enabled: boolean = true,
    executable?: string,
    args: string[] = []
): LanguageConfiguration {
    return {
        enabled,
        executable,
        args
    };
}

/**
 * Merge two language configurations
 */
export function mergeLanguageConfig(
    base: LanguageConfiguration,
    override: Partial<LanguageConfiguration>
): LanguageConfiguration {
    return {
        ...base,
        ...override,
        args: [...(base.args || []), ...(override.args || [])]
    };
}

/**
 * Validate a language configuration
 */
export function validateLanguageConfig(config: any): config is LanguageConfiguration {
    if (typeof config !== 'object' || config === null) {
        return false;
    }
    
    if (typeof config.enabled !== 'boolean') {
        return false;
    }
    
    if (config.executable !== undefined && typeof config.executable !== 'string') {
        return false;
    }
    
    if (config.args !== undefined && !Array.isArray(config.args)) {
        return false;
    }
    
    return true;
}
