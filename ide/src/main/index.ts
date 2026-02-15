/**
 * @fileoverview Main Electron process entry point
 * @module main
 */

import { app } from 'electron';
import { createWindow, getMainWindow } from './window';
import { createMenu } from './menu';
import { registerIPCHandlers, setMainWindow, cleanupTerminals, sendToRenderer } from './ipc';

// Set app name
app.setName('Kimi IDE');

/**
 * Initializes the application
 */
function initializeApp(): void {
  // Create main window
  const window = createWindow();
  
  // Set window reference for IPC handlers
  setMainWindow(window);
  
  // Register all IPC handlers
  registerIPCHandlers();
  
  // Create application menu
  createMenu({
    onOpenFolder: handleOpenFolder,
    onQuit: handleQuit
  });
  
  // Handle window closed
  window.on('closed', () => {
    cleanupTerminals();
    setMainWindow(null);
  });
}

/**
 * Handles opening a folder
 */
async function handleOpenFolder(): Promise<void> {
  const window = getMainWindow();
  if (!window) return;

  // The actual dialog is handled by IPC handler
  sendToRenderer('menu:open-folder');
}

/**
 * Handles quitting the application
 */
function handleQuit(): void {
  cleanupTerminals();
  app.quit();
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (getMainWindow() === null) {
    initializeApp();
  }
});

// Import tool handlers (keeps backward compatibility)
import './toolHandlers';

// Re-exports
export { createWindow, getMainWindow } from './window';
export { createMenu } from './menu';
export { registerIPCHandlers, sendToRenderer } from './ipc';
