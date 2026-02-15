import { ipcRenderer, IpcRendererEvent } from 'electron';

// Re-export language APIs
import { go } from '../languages/go/renderer-ipc';
import * as rust from '../languages/rust/renderer-api';
import * as gitAPI from '../git/renderer-api';
import { problems } from '../problems/renderer-ipc';
import { TaskIPCAPI } from '../tasks/ipc/TaskIPC';
import { DebuggerRendererIPC } from '../debugger/DebuggerIPC';
import { SearchIPCClient, getSearchClient, disposeSearchClient } from '../search/ipc';
import { outlineAPI } from '../outline/OutlineIPC';

// Export all module APIs
export { go, rust, problems, TaskIPCAPI, DebuggerRendererIPC, outlineAPI };
export { getSearchClient, disposeSearchClient };

// Workspace API
export const workspace = {
  openFolder: async (): Promise<string | null> => {
    return ipcRenderer.invoke('dialog:openFolder');
  },

  readDirectory: async (path: string): Promise<Array<{ name: string; isDirectory: boolean }>> => {
    const entries = await ipcRenderer.invoke('workspace:readDirectory', path);
    // Flatten the recursive structure for simple list
    return entries.map((e: any) => ({
      name: e.name,
      isDirectory: e.isDirectory
    }));
  },

  readFile: async (path: string): Promise<string> => {
    return ipcRenderer.invoke('workspace:readFile', path);
  },

  writeFile: async (path: string, content: string): Promise<void> => {
    return ipcRenderer.invoke('workspace:writeFile', path, content);
  },

  createFile: async (path: string): Promise<void> => {
    return ipcRenderer.invoke('workspace:createFile', path);
  },

  deleteFile: async (path: string): Promise<void> => {
    return ipcRenderer.invoke('workspace:deleteFile', path);
  },
};

// Language API
export const language = {
  detect: async (filePath: string): Promise<{ id: string; name: string; confidence: number } | null> => {
    return ipcRenderer.invoke('language:detect', filePath);
  },

  initialize: async (workspaceRoot: string, languageId?: string): Promise<{ success: boolean; languageId?: string }> => {
    return ipcRenderer.invoke('language:initialize', workspaceRoot, languageId);
  },

  getActive: async (workspaceRoot: string): Promise<{ hasProvider: boolean }> => {
    return ipcRenderer.invoke('language:getActive', workspaceRoot);
  },
};

// AI API
export const ai = {
  chat: async (messages: Array<{ role: string; content: string }>): Promise<any> => {
    // For now, use the local server
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });
      return response.json();
    } catch (error) {
      console.error('AI chat error:', error);
      throw error;
    }
  }
};

// Terminal API
export const terminal = {
  execute: async (command: string): Promise<{ stdout: string; stderr: string }> => {
    const result = await ipcRenderer.invoke('shell:execute', command);
    if (result.success) {
      return { stdout: result.stdout, stderr: result.stderr };
    } else {
      throw new Error(result.error);
    }
  }
};

// Git API
export const git = gitAPI;

// Search API (singleton client)
let searchClientInstance: SearchIPCClient | null = null;

export const search = {
  getClient: (): SearchIPCClient => {
    if (!searchClientInstance) {
      searchClientInstance = getSearchClient();
    }
    return searchClientInstance;
  },

  dispose: (): void => {
    disposeSearchClient();
    searchClientInstance = null;
  },
};

// Debugger API (via DebuggerRendererIPC static methods)
export const debug = {
  start: DebuggerRendererIPC.start,
  stop: DebuggerRendererIPC.stop,
  pause: DebuggerRendererIPC.pause,
  continue: DebuggerRendererIPC.continue,
  stepOver: DebuggerRendererIPC.stepOver,
  stepInto: DebuggerRendererIPC.stepInto,
  stepOut: DebuggerRendererIPC.stepOut,
  restart: DebuggerRendererIPC.restart,
  getConfigurations: DebuggerRendererIPC.getConfigurations,
  addConfiguration: DebuggerRendererIPC.addConfiguration,
  removeConfiguration: DebuggerRendererIPC.removeConfiguration,
  setActiveConfiguration: DebuggerRendererIPC.setActiveConfiguration,
  setBreakpoint: DebuggerRendererIPC.setBreakpoint,
  removeBreakpoint: DebuggerRendererIPC.removeBreakpoint,
  clearBreakpoints: DebuggerRendererIPC.clearBreakpoints,
  getBreakpoints: DebuggerRendererIPC.getBreakpoints,
  evaluate: DebuggerRendererIPC.evaluate,
  getState: DebuggerRendererIPC.getState,
  // Event listeners
  onStateChanged: DebuggerRendererIPC.onStateChanged,
  onStopped: DebuggerRendererIPC.onStopped,
  onContinued: DebuggerRendererIPC.onContinued,
  onOutput: DebuggerRendererIPC.onOutput,
  onTerminated: DebuggerRendererIPC.onTerminated,
  onBreakpointChanged: DebuggerRendererIPC.onBreakpointChanged,
  onCurrentLineChanged: DebuggerRendererIPC.onCurrentLineChanged,
};

// Tasks API (via TaskIPCAPI)
export const tasks = {
  load: TaskIPCAPI.load,
  detect: TaskIPCAPI.detect,
  run: TaskIPCAPI.run,
  terminate: TaskIPCAPI.terminate,
  getRunning: TaskIPCAPI.getRunning,
  create: TaskIPCAPI.create,
  update: TaskIPCAPI.update,
  delete: TaskIPCAPI.delete,
  import: TaskIPCAPI.import,
  importAll: TaskIPCAPI.importAll,
  getHistory: TaskIPCAPI.getHistory,
  clearHistory: TaskIPCAPI.clearHistory,
  dispose: TaskIPCAPI.dispose,
  onOutput: TaskIPCAPI.onOutput,
  onStatusChange: TaskIPCAPI.onStatusChange,
  onComplete: TaskIPCAPI.onComplete,
};

// Outline API
export const outline = {
  getDocumentSymbols: outlineAPI.getDocumentSymbols.bind(outlineAPI),
  getWorkspaceSymbols: outlineAPI.getWorkspaceSymbols.bind(outlineAPI),
  resolveLocation: outlineAPI.resolveLocation.bind(outlineAPI),
  getBreadcrumbs: outlineAPI.getBreadcrumbs.bind(outlineAPI),
  documentChanged: outlineAPI.documentChanged.bind(outlineAPI),
  cursorMoved: outlineAPI.cursorMoved.bind(outlineAPI),
  onDocumentChanged: outlineAPI.onDocumentChanged.bind(outlineAPI),
  onCursorMoved: outlineAPI.onCursorMoved.bind(outlineAPI),
};

// Menu/Events API
export const menu = {
  on: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeListener(channel, callback);
  },

  once: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.once(channel, callback);
  },

  off: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.off(channel, callback);
  },
};

// Expose to window
if (typeof window !== 'undefined') {
  (window as any).electron = {
    workspace,
    ai,
    terminal,
    git,
    go,
    rust,
    problems,
    language,
    search,
    debug,
    tasks,
    outline,
    menu,
  };
}

// Type declarations for TypeScript
declare global {
  interface Window {
    electron: {
      workspace: typeof workspace;
      ai: typeof ai;
      terminal: typeof terminal;
      git: typeof git;
      go: typeof go;
      rust: typeof rust;
      problems: typeof problems;
      language: typeof language;
      search: typeof search;
      debugger: typeof debugger;
      tasks: typeof tasks;
      outline: typeof outline;
      menu: typeof menu;
    };
  }
}

export default {
  workspace,
  ai,
  terminal,
  git,
  go,
  rust,
  problems,
  language,
  search,
  debug,
  tasks,
  outline,
  menu,
};
