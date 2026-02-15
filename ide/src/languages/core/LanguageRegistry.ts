/**
 * Language Registry - Manages all language providers
 * IDE Kimi IDE - Language Support Framework
 */

import { BaseLanguageProvider, LanguageProviderState } from './BaseLanguageProvider';
import { EventEmitter, Disposable } from './types';

/**
 * Event fired when a language provider is registered
 */
export interface LanguageRegisteredEvent {
    /** Language identifier */
    id: string;
    /** Language provider instance */
    provider: BaseLanguageProvider;
}

/**
 * Event fired when a language provider is unregistered
 */
export interface LanguageUnregisteredEvent {
    /** Language identifier */
    id: string;
    /** Language provider instance */
    provider: BaseLanguageProvider;
}

/**
 * Event fired when languages are detected in a project
 */
export interface LanguagesDetectedEvent {
    /** Project path */
    projectPath: string;
    /** Detected language IDs */
    languages: string[];
}

/**
 * Registry for all language providers in IDE Kimi IDE
 * 
 * This class manages the lifecycle of language providers and provides
 * methods to discover and access language support for files and projects.
 * 
 * @example
 * ```typescript
 * const registry = new LanguageRegistry();
 * 
 * // Register a language provider
 * registry.register(new TypeScriptProvider());
 * 
 * // Detect languages in a project
 * const languages = await registry.detectLanguages('/path/to/project');
 * 
 * // Get provider for a specific file
 * const provider = registry.getProviderForFile('/path/to/file.ts');
 * ```
 */
export class LanguageRegistry implements Disposable {
    /** Map of registered language providers */
    private providers: Map<string, BaseLanguageProvider> = new Map();

    /** Map of file extensions to language IDs */
    private extensionMap: Map<string, string[]> = new Map();

    /** Event emitter for registration events */
    private onDidRegisterEmitter = new EventEmitter<LanguageRegisteredEvent>();

    /** Event emitter for unregistration events */
    private onDidUnregisterEmitter = new EventEmitter<LanguageUnregisteredEvent>();

    /** Event emitter for detection events */
    private onDidDetectLanguagesEmitter = new EventEmitter<LanguagesDetectedEvent>();

    // ============================================================================
    // Registration Management
    // ============================================================================

    /**
     * Register a language provider
     * @param provider - The language provider to register
     * @returns Disposable that unregisters the provider when disposed
     * @throws Error if a provider with the same ID is already registered
     * 
     * @example
     * ```typescript
     * const disposable = registry.register(new TypeScriptProvider());
     * 
     * // Later, to unregister:
     * disposable.dispose();
     * ```
     */
    register(provider: BaseLanguageProvider): Disposable {
        if (this.providers.has(provider.id)) {
            throw new Error(
                `Language provider with id '${provider.id}' is already registered. ` +
                `Unregister the existing provider first.`
            );
        }

        this.providers.set(provider.id, provider);

        // Register extensions
        for (const ext of provider.extensions) {
            const normalizedExt = this.normalizeExtension(ext);
            const existing = this.extensionMap.get(normalizedExt) || [];
            if (!existing.includes(provider.id)) {
                existing.push(provider.id);
                this.extensionMap.set(normalizedExt, existing);
            }
        }

        // Emit registration event
        this.onDidRegisterEmitter.emit({ id: provider.id, provider });

        return {
            dispose: () => {
                this.unregister(provider.id);
            }
        };
    }

    /**
     * Unregister a language provider
     * @param id - The language identifier to unregister
     * @returns The unregistered provider, or undefined if not found
     * 
     * @example
     * ```typescript
     * const provider = registry.unregister('typescript');
     * if (provider) {
     *   await provider.deactivate();
     * }
     * ```
     */
    unregister(id: string): BaseLanguageProvider | undefined {
        const provider = this.providers.get(id);
        
        if (!provider) {
            return undefined;
        }

        // Remove from providers map
        this.providers.delete(id);

        // Remove from extension map
        for (const ext of provider.extensions) {
            const normalizedExt = this.normalizeExtension(ext);
            const existing = this.extensionMap.get(normalizedExt);
            if (existing) {
                const index = existing.indexOf(id);
                if (index !== -1) {
                    existing.splice(index, 1);
                    if (existing.length === 0) {
                        this.extensionMap.delete(normalizedExt);
                    } else {
                        this.extensionMap.set(normalizedExt, existing);
                    }
                }
            }
        }

        // Deactivate if active
        if (provider.active) {
            provider.deactivate().catch(error => {
                console.error(`Error deactivating provider '${id}':`, error);
            });
        }

        // Emit unregistration event
        this.onDidUnregisterEmitter.emit({ id, provider });

        return provider;
    }

    /**
     * Check if a language provider is registered
     * @param id - The language identifier to check
     */
    isRegistered(id: string): boolean {
        return this.providers.has(id);
    }

    /**
     * Get all registered language IDs
     */
    getRegisteredLanguages(): string[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Get all registered providers
     */
    getAllProviders(): BaseLanguageProvider[] {
        return Array.from(this.providers.values());
    }

    // ============================================================================
    // Provider Access
    // ============================================================================

    /**
     * Get a language provider by ID
     * @param id - The language identifier
     * @returns The language provider, or undefined if not found
     */
    getProvider(id: string): BaseLanguageProvider | undefined {
        return this.providers.get(id);
    }

    /**
     * Get the first provider that matches the given file
     * @param filePath - Absolute path to the file
     * @returns The matching provider, or null if no match found
     * 
     * @example
     * ```typescript
     * const provider = registry.getProviderForFile('/path/to/file.ts');
     * if (provider) {
     *   const completions = await provider.provideCompletions(file, position, context);
     * }
     * ```
     */
    getProviderForFile(filePath: string): BaseLanguageProvider | null {
        const ext = this.extractExtension(filePath);
        const languageIds = this.extensionMap.get(ext);
        
        if (!languageIds || languageIds.length === 0) {
            return null;
        }

        // Return the first matching provider
        for (const id of languageIds) {
            const provider = this.providers.get(id);
            if (provider) {
                return provider;
            }
        }

        return null;
    }

    /**
     * Get all providers that can handle a specific file extension
     * @param extension - File extension (with or without leading dot)
     * @returns Array of matching providers
     */
    getProvidersForExtension(extension: string): BaseLanguageProvider[] {
        const normalizedExt = this.normalizeExtension(extension);
        const languageIds = this.extensionMap.get(normalizedExt) || [];
        
        return languageIds
            .map(id => this.providers.get(id))
            .filter((provider): provider is BaseLanguageProvider => provider !== undefined);
    }

    /**
     * Get all providers that are currently active
     */
    getActiveProviders(): BaseLanguageProvider[] {
        return this.getAllProviders().filter(provider => provider.active);
    }

    // ============================================================================
    // Language Detection
    // ============================================================================

    /**
     * Detect which languages are applicable to a project
     * @param projectPath - Path to the project root directory
     * @returns Promise resolving to array of detected language IDs
     * 
     * @example
     * ```typescript
     * const languages = await registry.detectLanguages('/path/to/project');
     * console.log('Detected languages:', languages);
     * // Output: ['typescript', 'json']
     * ```
     */
    async detectLanguages(projectPath: string): Promise<string[]> {
        const detected: string[] = [];
        const detectionPromises: Promise<void>[] = [];

        for (const [id, provider] of this.providers) {
            const detectPromise = provider.detect(projectPath).then(isDetected => {
                if (isDetected) {
                    detected.push(id);
                }
            }).catch(error => {
                console.error(`Error detecting language '${id}':`, error);
            });
            
            detectionPromises.push(detectPromise);
        }

        await Promise.all(detectionPromises);

        // Sort detected languages alphabetically for consistent results
        detected.sort();

        // Emit detection event
        this.onDidDetectLanguagesEmitter.emit({ projectPath, languages: detected });

        return detected;
    }

    /**
     * Detect and auto-activate all applicable languages for a project
     * @param projectPath - Path to the project root directory
     * @returns Promise resolving to array of activated language IDs
     */
    async autoActivate(projectPath: string): Promise<string[]> {
        const detected = await this.detectLanguages(projectPath);
        const activated: string[] = [];
        const activationPromises: Promise<void>[] = [];

        for (const id of detected) {
            const provider = this.providers.get(id);
            if (provider && !provider.active) {
                const activatePromise = provider.activate(projectPath).then(() => {
                    activated.push(id);
                }).catch(error => {
                    console.error(`Error activating language '${id}':`, error);
                });
                
                activationPromises.push(activatePromise);
            }
        }

        await Promise.all(activationPromises);

        return activated;
    }

    /**
     * Deactivate all active language providers
     */
    async deactivateAll(): Promise<void> {
        const deactivationPromises: Promise<void>[] = [];

        for (const provider of this.providers.values()) {
            if (provider.active) {
                deactivationPromises.push(
                    provider.deactivate().catch(error => {
                        console.error(`Error deactivating '${provider.id}':`, error);
                    })
                );
            }
        }

        await Promise.all(deactivationPromises);
    }

    // ============================================================================
    // Events
    // ============================================================================

    /**
     * Event fired when a language provider is registered
     */
    get onDidRegister(): EventEmitter<LanguageRegisteredEvent> {
        return this.onDidRegisterEmitter;
    }

    /**
     * Event fired when a language provider is unregistered
     */
    get onDidUnregister(): EventEmitter<LanguageUnregisteredEvent> {
        return this.onDidUnregisterEmitter;
    }

    /**
     * Event fired when languages are detected in a project
     */
    get onDidDetectLanguages(): EventEmitter<LanguagesDetectedEvent> {
        return this.onDidDetectLanguagesEmitter;
    }

    // ============================================================================
    // Utility Methods
    // ============================================================================

    /**
     * Get information about all registered languages
     */
    getLanguageInfo(): LanguageInfo[] {
        return Array.from(this.providers.values()).map(provider => ({
            id: provider.id,
            name: provider.name,
            extensions: provider.extensions,
            active: provider.active
        }));
    }

    /**
     * Check if any provider supports a specific file
     * @param filePath - Path to the file
     */
    hasProviderForFile(filePath: string): boolean {
        return this.getProviderForFile(filePath) !== null;
    }

    /**
     * Get all file extensions supported by registered providers
     */
    getSupportedExtensions(): string[] {
        return Array.from(this.extensionMap.keys());
    }

    /**
     * Clear all registered providers
     */
    clear(): void {
        this.deactivateAll().then(() => {
            this.providers.clear();
            this.extensionMap.clear();
        });
    }

    /**
     * Dispose of the registry and all registered providers
     */
    dispose(): void {
        this.deactivateAll().then(() => {
            this.providers.clear();
            this.extensionMap.clear();
            this.onDidRegisterEmitter.dispose();
            this.onDidUnregisterEmitter.dispose();
            this.onDidDetectLanguagesEmitter.dispose();
        });
    }

    // ============================================================================
    // Private Helpers
    // ============================================================================

    /**
     * Normalize a file extension (ensure leading dot, lowercase)
     */
    private normalizeExtension(ext: string): string {
        const normalized = ext.startsWith('.') ? ext : `.${ext}`;
        return normalized.toLowerCase();
    }

    /**
     * Extract the file extension from a file path
     */
    private extractExtension(filePath: string): string {
        const lastDotIndex = filePath.lastIndexOf('.');
        const lastSepIndex = Math.max(
            filePath.lastIndexOf('/'),
            filePath.lastIndexOf('\\')
        );
        
        // Make sure the dot is part of the filename, not a directory
        if (lastDotIndex > lastSepIndex) {
            return filePath.substring(lastDotIndex).toLowerCase();
        }
        
        return '';
    }
}

/**
 * Information about a registered language
 */
export interface LanguageInfo {
    /** Language identifier */
    id: string;
    /** Human-readable name */
    name: string;
    /** Supported file extensions */
    extensions: string[];
    /** Whether the provider is currently active */
    active: boolean;
}

/**
 * Global language registry instance
 * Use this for singleton access throughout the application
 */
export const globalLanguageRegistry = new LanguageRegistry();
