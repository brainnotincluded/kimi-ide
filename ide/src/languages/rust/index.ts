/**
 * Rust Language Support for Kimi IDE IDE
 * Complete Rust toolchain integration with cargo, rust-analyzer and rustfmt
 */

// Types
export * from './types';

// Provider
export { RustLanguageProvider, getRustProvider, setRustProvider } from './provider';

// Config
export { RustConfigManager, getConfigManager, cleanupConfigManagers } from './config';

// IPC (main process)
export { setupRustIPCHandlers, cleanupRustProviders } from './ipc';

// Renderer API
export * from './renderer-api';

// Components
export * from './components';

// Hooks
export * from './hooks';

// Version
export const RUST_SUPPORT_VERSION = '0.1.0';
export default RUST_SUPPORT_VERSION;
