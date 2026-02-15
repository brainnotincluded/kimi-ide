/**
 * @fileoverview Application menu
 * @module main/menu
 */

import { Menu, app } from 'electron';
import { sendToRenderer, isWindowReady } from './window';

export interface MenuCallbacks {
  onOpenFolder?: () => void;
  onQuit?: () => void;
}

/**
 * Creates the application menu
 */
export function createMenu(callbacks: MenuCallbacks = {}): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { 
          label: 'Open Folder', 
          accelerator: 'Cmd+O', 
          click: callbacks.onOpenFolder || openFolder 
        },
        { type: 'separator' },
        { 
          label: 'Quit', 
          accelerator: 'Cmd+Q', 
          click: callbacks.onQuit || (() => app.quit()) 
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { 
          label: 'Toggle Sidebar', 
          accelerator: 'Cmd+B', 
          click: () => sendToRenderer('menu:toggle-sidebar') 
        },
        { 
          label: 'Toggle Terminal', 
          accelerator: 'Cmd+J', 
          click: () => sendToRenderer('menu:toggle-terminal') 
        },
        { type: 'separator' },
        { 
          label: 'Toggle Problems', 
          accelerator: 'Cmd+Shift+M', 
          click: () => sendToRenderer('menu:toggle-problems') 
        },
        { 
          label: 'Toggle Output', 
          accelerator: 'Cmd+Shift+U', 
          click: () => sendToRenderer('menu:toggle-output') 
        },
        { type: 'separator' },
        { 
          label: 'Command Palette', 
          accelerator: 'Cmd+Shift+P', 
          click: () => sendToRenderer('menu:command-palette') 
        }
      ]
    },
    {
      label: 'Terminal',
      submenu: [
        { 
          label: 'New Terminal', 
          accelerator: 'Ctrl+`', 
          click: () => sendToRenderer('terminal:new') 
        },
        { 
          label: 'Kill Terminal', 
          click: () => sendToRenderer('terminal:kill') 
        },
        { type: 'separator' },
        { 
          label: 'Clear Terminal', 
          click: () => sendToRenderer('terminal:clear') 
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 * Opens a folder dialog and notifies the renderer
 */
async function openFolder(): Promise<void> {
  // This is a placeholder - actual implementation would use dialog
  // The actual implementation is in ipc/dialog.ts
  sendToRenderer('menu:open-folder');
}

/**
 * Updates the menu (useful for enabling/disabling items)
 */
export function updateMenu(): void {
  // Future: dynamically enable/disable menu items based on state
}
