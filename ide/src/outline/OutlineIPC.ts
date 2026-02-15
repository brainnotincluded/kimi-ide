/**
 * OutlineIPC
 * IPC handlers for outline functionality
 * Connects OutlineProvider with the main process and renderer
 */

import { ipcMain, ipcRenderer, IpcMainInvokeEvent } from 'electron';
import { OutlineProvider } from './OutlineProvider';
import {
  DocumentSymbol,
  WorkspaceSymbol,
  NavigationTarget,
  Position,
  OutlineOptions,
  OutlineIPCMessage,
} from './types';

// Channel names
export const IPC_CHANNELS = {
  GET_SYMBOLS: 'outline:getSymbols',
  GET_WORKSPACE_SYMBOLS: 'outline:getWorkspaceSymbols',
  RESOLVE_LOCATION: 'outline:resolveLocation',
  DOCUMENT_CHANGED: 'outline:documentChanged',
  CURSOR_MOVED: 'outline:cursorMoved',
  UPDATE_OPTIONS: 'outline:updateOptions',
  GET_BREADCRUMBS: 'outline:getBreadcrumbs',
} as const;

/**
 * Setup IPC handlers for main process
 */
export function setupOutlineIPC(provider: OutlineProvider): void {
  // Get document symbols
  ipcMain.handle(
    IPC_CHANNELS.GET_SYMBOLS,
    async (_event: IpcMainInvokeEvent, uri: string, content: string): Promise<DocumentSymbol[]> => {
      try {
        return await provider.getDocumentSymbols(uri, content);
      } catch (error) {
        console.error('Failed to get document symbols:', error);
        return [];
      }
    }
  );

  // Get workspace symbols
  ipcMain.handle(
    IPC_CHANNELS.GET_WORKSPACE_SYMBOLS,
    async (
      _event: IpcMainInvokeEvent,
      query: string,
      workspacePath: string
    ): Promise<WorkspaceSymbol[]> => {
      try {
        return await provider.getWorkspaceSymbols(query, workspacePath);
      } catch (error) {
        console.error('Failed to get workspace symbols:', error);
        return [];
      }
    }
  );

  // Resolve location for navigation
  ipcMain.handle(
    IPC_CHANNELS.RESOLVE_LOCATION,
    async (
      _event: IpcMainInvokeEvent,
      uri: string,
      position: Position
    ): Promise<NavigationTarget | undefined> => {
      try {
        return await provider.goToSymbol(uri, position);
      } catch (error) {
        console.error('Failed to resolve location:', error);
        return undefined;
      }
    }
  );

  // Get breadcrumbs
  ipcMain.handle(
    IPC_CHANNELS.GET_BREADCRUMBS,
    async (
      _event: IpcMainInvokeEvent,
      uri: string,
      position: Position
    ): Promise<DocumentSymbol[]> => {
      try {
        return await provider.getBreadcrumbs(uri, position);
      } catch (error) {
        console.error('Failed to get breadcrumbs:', error);
        return [];
      }
    }
  );
}

/**
 * Remove IPC handlers
 */
export function removeOutlineIPC(): void {
  ipcMain.removeHandler(IPC_CHANNELS.GET_SYMBOLS);
  ipcMain.removeHandler(IPC_CHANNELS.GET_WORKSPACE_SYMBOLS);
  ipcMain.removeHandler(IPC_CHANNELS.RESOLVE_LOCATION);
  ipcMain.removeHandler(IPC_CHANNELS.GET_BREADCRUMBS);
}

/**
 * IPC API for renderer process
 */
export class OutlineRendererAPI {
  /**
   * Get document symbols for a file
   */
  async getDocumentSymbols(uri: string, content: string): Promise<DocumentSymbol[]> {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SYMBOLS, uri, content);
  }

  /**
   * Get workspace symbols
   */
  async getWorkspaceSymbols(query: string, workspacePath: string): Promise<WorkspaceSymbol[]> {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_WORKSPACE_SYMBOLS, query, workspacePath);
  }

  /**
   * Go to symbol at position
   */
  async resolveLocation(uri: string, position: Position): Promise<NavigationTarget | undefined> {
    return ipcRenderer.invoke(IPC_CHANNELS.RESOLVE_LOCATION, uri, position);
  }

  /**
   * Get breadcrumbs for position
   */
  async getBreadcrumbs(uri: string, position: Position): Promise<DocumentSymbol[]> {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_BREADCRUMBS, uri, position);
  }

  /**
   * Notify that document has changed
   */
  documentChanged(uri: string): void {
    ipcRenderer.send(IPC_CHANNELS.DOCUMENT_CHANGED, uri);
  }

  /**
   * Notify that cursor has moved
   */
  cursorMoved(uri: string, position: Position): void {
    ipcRenderer.send(IPC_CHANNELS.CURSOR_MOVED, uri, position);
  }

  /**
   * Listen for document changes
   */
  onDocumentChanged(callback: (uri: string) => void): () => void {
    const handler = (_event: any, uri: string) => callback(uri);
    ipcRenderer.on(IPC_CHANNELS.DOCUMENT_CHANGED, handler);
    return () => ipcRenderer.off(IPC_CHANNELS.DOCUMENT_CHANGED, handler);
  }

  /**
   * Listen for cursor movement
   */
  onCursorMoved(callback: (uri: string, position: Position) => void): () => void {
    const handler = (_event: any, uri: string, position: Position) => callback(uri, position);
    ipcRenderer.on(IPC_CHANNELS.CURSOR_MOVED, handler);
    return () => ipcRenderer.off(IPC_CHANNELS.CURSOR_MOVED, handler);
  }
}

// Export singleton instance for renderer
export const outlineAPI = new OutlineRendererAPI();

export default outlineAPI;
