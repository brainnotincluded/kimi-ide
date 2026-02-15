/**
 * Configuration management for Kimi IDE
 * Handles VS Code settings and kimi-cli config integration
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

const CONFIG_SECTION = 'kimi';

export interface KimiConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
    enableCodeActions: boolean;
    enableInlineEdit: boolean;
    enableStatusBar: boolean;
    debug: boolean;
}

const DEFAULT_CONFIG: KimiConfig = {
    apiKey: '',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-128k',
    maxTokens: 4096,
    temperature: 0.7,
    enableCodeActions: true,
    enableInlineEdit: true,
    enableStatusBar: true,
    debug: false,
};

/**
 * Get configuration value from VS Code settings
 */
export function getConfig<T>(key: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return config.get<T>(key, defaultValue);
}

/**
 * Get full Kimi configuration
 */
export function getFullConfig(): KimiConfig {
    return {
        apiKey: getConfig('apiKey', DEFAULT_CONFIG.apiKey),
        baseUrl: getConfig('baseUrl', DEFAULT_CONFIG.baseUrl),
        model: getConfig('model', DEFAULT_CONFIG.model),
        maxTokens: getConfig('maxTokens', DEFAULT_CONFIG.maxTokens),
        temperature: getConfig('temperature', DEFAULT_CONFIG.temperature),
        enableCodeActions: getConfig('enableCodeActions', DEFAULT_CONFIG.enableCodeActions),
        enableInlineEdit: getConfig('enableInlineEdit', DEFAULT_CONFIG.enableInlineEdit),
        enableStatusBar: getConfig('enableStatusBar', DEFAULT_CONFIG.enableStatusBar),
        debug: getConfig('debug', DEFAULT_CONFIG.debug),
    };
}

/**
 * Get kimi-cli config path
 */
function getKimiCliConfigPath(): string | null {
    const homeDir = os.homedir();
    
    // Check different possible config locations
    const possiblePaths = [
        path.join(homeDir, '.kimi', 'config.json'),
        path.join(homeDir, '.config', 'kimi', 'config.json'),
        path.join(homeDir, 'Library', 'Application Support', 'kimi', 'config.json'),
    ];

    for (const configPath of possiblePaths) {
        if (fs.existsSync(configPath)) {
            return configPath;
        }
    }

    return null;
}

/**
 * Read API key from kimi-cli config
 */
export async function getKimiCliApiKey(): Promise<string | null> {
    try {
        const configPath = getKimiCliConfigPath();
        if (!configPath) {
            return null;
        }

        const configContent = await fs.promises.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        
        return config.api_key || config.apiKey || null;
    } catch (error) {
        logError('Failed to read kimi-cli config', error);
        return null;
    }
}

/**
 * Update configuration value
 */
export async function updateConfig(key: string, value: unknown): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update(key, value, true);
}

/**
 * Check if API key is configured
 */
export async function isApiKeyConfigured(): Promise<boolean> {
    const config = getFullConfig();
    
    if (config.apiKey && config.apiKey.length > 0) {
        return true;
    }

    // Try to get from kimi-cli config
    const cliApiKey = await getKimiCliApiKey();
    return cliApiKey !== null && cliApiKey.length > 0;
}

/**
 * Get effective API key (from VS Code settings or kimi-cli config)
 */
export async function getEffectiveApiKey(): Promise<string> {
    const config = getFullConfig();
    
    if (config.apiKey && config.apiKey.length > 0) {
        return config.apiKey;
    }

    const cliApiKey = await getKimiCliApiKey();
    if (cliApiKey) {
        return cliApiKey;
    }

    throw new Error('Kimi API key not configured. Please set it in VS Code settings or kimi-cli config.');
}

/**
 * Logging utility
 */
export function log(message: string, ...args: unknown[]): void {
    const config = getFullConfig();
    if (config.debug) {
        console.log(`[Kimi IDE] ${message}`, ...args);
    }
}

/**
 * Error logging utility
 */
export function logError(message: string, error: unknown): void {
    const config = getFullConfig();
    if (config.debug) {
        console.error(`[Kimi IDE] ERROR: ${message}`, error);
    }
    
    // Always log errors to console
    console.error(`[Kimi IDE] ${message}:`, error);
}

/**
 * Show error message to user
 */
export function showError(message: string, error?: unknown): void {
    const fullMessage = error ? `${message}: ${error}` : message;
    vscode.window.showErrorMessage(`Kimi IDE: ${fullMessage}`);
    logError(message, error);
}

/**
 * Show info message to user
 */
export function showInfo(message: string): void {
    vscode.window.showInformationMessage(`Kimi IDE: ${message}`);
}

/**
 * Show warning message to user
 */
export function showWarning(message: string): void {
    vscode.window.showWarningMessage(`Kimi IDE: ${message}`);
}
