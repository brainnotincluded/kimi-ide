/**
 * Git Integration for Kimi IDE IDE
 * 
 * This module provides comprehensive Git integration similar to VS Code:
 * - Git operations (status, stage, commit, push, pull)
 * - Branch management
 * - History and blame
 * - Diff viewing
 * - Source control panel
 * - Status bar
 * - Inline decorations
 * 
 * @example
 * ```typescript
 * // Main process
 * import { setupGitIPCHandlers } from './git';
 * setupGitIPCHandlers();
 * 
 * // Renderer process
 * import { git } from './git';
 * const status = await git.init('/path/to/repo');
 * 
 * // UI Components
 * import { createSourceControlPanel, createGitStatusBar } from './git/ui';
 * const panel = createSourceControlPanel(container, '/path/to/repo', callbacks);
 * const statusBar = createGitStatusBar(container, callbacks);
 * ```
 */

// Export types
export * from './types';

// Export main process components
export { GitProvider, getGitProvider, resetGitProvider } from './GitProvider';
export { setupGitIPCHandlers, cleanupGitProviders } from './GitIPCHandler';

// Export renderer API as namespace
import * as gitAPI from './renderer-api';
export const git = gitAPI;

// Export UI components
export * from './ui';

// Default export for convenience
export default {
  ...gitAPI,
  setupGitIPCHandlers: () => {
    // This is a placeholder - actual setup happens in main process
    console.warn('setupGitIPCHandlers should be called from main process');
  },
};
