/**
 * Debug Configuration
 * IDE Kimi IDE - Debugger Framework
 */

import { DebugConfiguration, DebugConfigurationType, DebugRequestType } from './types';

// ============================================================================
// Configuration Validation
// ============================================================================

export interface ConfigurationValidationResult {
    valid: boolean;
    errors: string[];
}

// ============================================================================
// Debug Configuration Factory
// ============================================================================

export class DebugConfigurationFactory {
    /**
     * Создать конфигурацию для Python
     */
    static createPython(
        name: string,
        program: string,
        options?: Partial<Omit<DebugConfiguration, 'name' | 'type' | 'program'>>
    ): DebugConfiguration {
        return {
            name,
            type: 'python',
            request: 'launch',
            program,
            args: [],
            env: {},
            cwd: '',
            stopOnEntry: false,
            ...options
        };
    }

    /**
     * Создать конфигурацию для Node.js
     */
    static createNode(
        name: string,
        program: string,
        options?: Partial<Omit<DebugConfiguration, 'name' | 'type' | 'program'>>
    ): DebugConfiguration {
        return {
            name,
            type: 'node',
            request: 'launch',
            program,
            args: [],
            env: {},
            cwd: '',
            stopOnEntry: false,
            ...options
        };
    }

    /**
     * Создать конфигурацию для C/C++
     */
    static createCpp(
        name: string,
        program: string,
        options?: Partial<Omit<DebugConfiguration, 'name' | 'type' | 'program'>>
    ): DebugConfiguration {
        return {
            name,
            type: 'cppdbg',
            request: 'launch',
            program,
            args: [],
            env: {},
            cwd: '',
            stopOnEntry: false,
            ...options
        };
    }

    /**
     * Создать конфигурацию для Go
     */
    static createGo(
        name: string,
        program: string,
        options?: Partial<Omit<DebugConfiguration, 'name' | 'type' | 'program'>>
    ): DebugConfiguration {
        return {
            name,
            type: 'go',
            request: 'launch',
            program,
            args: [],
            env: {},
            cwd: '',
            stopOnEntry: false,
            ...options
        };
    }

    /**
     * Создать конфигурацию для Rust
     */
    static createRust(
        name: string,
        program: string,
        options?: Partial<Omit<DebugConfiguration, 'name' | 'type' | 'program'>>
    ): DebugConfiguration {
        return {
            name,
            type: 'rust',
            request: 'launch',
            program,
            args: [],
            env: {},
            cwd: '',
            stopOnEntry: false,
            ...options
        };
    }

    /**
     * Создать attach конфигурацию
     */
    static createAttach(
        type: DebugConfigurationType,
        name: string,
        host: string,
        port: number,
        options?: Partial<Omit<DebugConfiguration, 'name' | 'type' | 'request' | 'host' | 'port'>>
    ): DebugConfiguration {
        return {
            name,
            type,
            request: 'attach',
            program: '',
            host,
            port,
            env: {},
            cwd: '',
            ...options
        };
    }
}

// ============================================================================
// Configuration Validator
// ============================================================================

export class ConfigurationValidator {
    private static readonly VALID_TYPES: DebugConfigurationType[] = ['python', 'node', 'cppdbg', 'go', 'rust'];
    private static readonly VALID_REQUESTS: DebugRequestType[] = ['launch', 'attach'];

    /**
     * Валидировать конфигурацию
     */
    static validate(config: DebugConfiguration): ConfigurationValidationResult {
        const errors: string[] = [];

        // Проверка имени
        if (!config.name || config.name.trim().length === 0) {
            errors.push('Configuration name is required');
        }

        // Проверка типа
        if (!this.VALID_TYPES.includes(config.type)) {
            errors.push(`Invalid debug type: ${config.type}. Valid types: ${this.VALID_TYPES.join(', ')}`);
        }

        // Проверка request
        if (!this.VALID_REQUESTS.includes(config.request)) {
            errors.push(`Invalid request type: ${config.request}. Valid types: ${this.VALID_REQUESTS.join(', ')}`);
        }

        // Проверка программы для launch
        if (config.request === 'launch' && (!config.program || config.program.trim().length === 0)) {
            errors.push('Program path is required for launch configuration');
        }

        // Проверка host/port для attach
        if (config.request === 'attach') {
            if (!config.host) {
                errors.push('Host is required for attach configuration');
            }
            if (config.port === undefined || config.port === null) {
                errors.push('Port is required for attach configuration');
            } else if (config.port <= 0 || config.port > 65535) {
                errors.push('Port must be between 1 and 65535');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Получить путь к debug adapter для типа
     */
    static getDebugAdapterPath(type: DebugConfigurationType): string {
        switch (type) {
            case 'python':
                return 'debugpy';
            case 'node':
                return 'node-debug2';
            case 'cppdbg':
                return 'OpenDebugAD7';
            case 'go':
                return 'dlv';
            case 'rust':
                return 'lldb';
            default:
                throw new Error(`Unknown debug type: ${type}`);
        }
    }

    /**
     * Получить аргументы для debug adapter
     */
    static getDebugAdapterArgs(type: DebugConfigurationType): string[] {
        switch (type) {
            case 'python':
                return ['--listen', '0.0.0.0:0', '--wait-for-client'];
            case 'node':
                return ['--stdio'];
            case 'cppdbg':
                return ['--interpreter=vscode'];
            case 'go':
                return ['dap'];
            case 'rust':
                return ['--interpreter=vscode'];
            default:
                return [];
        }
    }
}

// ============================================================================
// Configuration Manager
// ============================================================================

export class DebugConfigurationManager {
    private configurations: Map<string, DebugConfiguration> = new Map();
    private activeConfiguration: string | null = null;

    /**
     * Добавить конфигурацию
     */
    addConfiguration(config: DebugConfiguration): void {
        const validation = ConfigurationValidator.validate(config);
        if (!validation.valid) {
            throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
        }
        this.configurations.set(config.name, config);
    }

    /**
     * Удалить конфигурацию
     */
    removeConfiguration(name: string): boolean {
        const deleted = this.configurations.delete(name);
        if (this.activeConfiguration === name) {
            this.activeConfiguration = null;
        }
        return deleted;
    }

    /**
     * Получить конфигурацию по имени
     */
    getConfiguration(name: string): DebugConfiguration | undefined {
        return this.configurations.get(name);
    }

    /**
     * Получить все конфигурации
     */
    getAllConfigurations(): DebugConfiguration[] {
        return Array.from(this.configurations.values());
    }

    /**
     * Получить конфигурации по типу
     */
    getConfigurationsByType(type: DebugConfigurationType): DebugConfiguration[] {
        return this.getAllConfigurations().filter(c => c.type === type);
    }

    /**
     * Установить активную конфигурацию
     */
    setActiveConfiguration(name: string): boolean {
        if (!this.configurations.has(name)) {
            return false;
        }
        this.activeConfiguration = name;
        return true;
    }

    /**
     * Получить активную конфигурацию
     */
    getActiveConfiguration(): DebugConfiguration | undefined {
        if (!this.activeConfiguration) {
            return undefined;
        }
        return this.configurations.get(this.activeConfiguration);
    }

    /**
     * Очистить все конфигурации
     */
    clear(): void {
        this.configurations.clear();
        this.activeConfiguration = null;
    }

    /**
     * Загрузить конфигурации из объекта
     */
    loadConfigurations(configs: DebugConfiguration[]): void {
        this.clear();
        for (const config of configs) {
            try {
                this.addConfiguration(config);
            } catch (error) {
                console.warn(`Failed to load configuration '${config.name}':`, error);
            }
        }
    }

    /**
     * Сохранить конфигурации в объект
     */
    saveConfigurations(): DebugConfiguration[] {
        return this.getAllConfigurations();
    }
}
