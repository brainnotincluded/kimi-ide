/**
 * Go Language Support for Kimi IDE IDE
 * 
 * Complete Go language support including:
 * - GoLanguageProvider: Core language functionality
 * - Components: React UI components
 * - IPC: Main and renderer process communication
 * - Types: TypeScript type definitions
 * 
 * @example
 * ```typescript
 * // Main process
 * import { initGoIPCHandlers } from './languages/go';
 * initGoIPCHandlers('/path/to/project');
 * 
 * // Renderer process
 * import { GoStatusBar, GoModulesPanel } from './languages/go/components';
 * import go from './languages/go/renderer-ipc';
 * 
 * // Use in components
 * <GoStatusBar provider={provider} />
 * <GoModulesPanel provider={provider} />
 * 
 * // Direct API usage
 * const result = await go.build();
 * const completions = await go.getCompletions('/path/file.go', 10, 5);
 * ```
 */

// Main process exports
export { GoLanguageProvider } from './provider';
export { initGoIPCHandlers, getGoProvider, disposeGoIPC } from './ipc';

// Renderer exports
export { go as default, go } from './renderer-ipc';
export { GoStatusBar, GoModulesPanel, GoSettingsPanel } from './components';

// Config
export * from './config';

// Types
export * from './types';

// Version
export const GO_SUPPORT_VERSION = '1.0.0';
