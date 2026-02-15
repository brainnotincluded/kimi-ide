/**
 * Task IPC Handlers
 * Main process IPC handlers for task operations
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import {
  TaskProvider,
  TaskProviderOptions,
} from '../TaskProvider';
import {
  TaskDefinition,
  DetectedTask,
  TasksConfig,
} from '../types';

// Store task providers per workspace
const taskProviders = new Map<string, TaskProvider>();

/**
 * Get or create a task provider for a workspace
 */
function getTaskProvider(workspacePath: string): TaskProvider {
  if (!taskProviders.has(workspacePath)) {
    const provider = new TaskProvider({
      projectPath: workspacePath,
    });
    
    // Set up event handlers
    provider.on('output', (taskId: string, line) => {
      // Broadcast to all windows
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send(`tasks:output:${taskId}`, {
            content: line.content,
            type: line.type,
          });
        }
      }
    });

    provider.on('statusChange', (taskId: string, status) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send('tasks:statusChange', { taskId, status });
        }
      }
    });

    provider.on('taskComplete', (result) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send('tasks:complete', result);
        }
      }
    });

    taskProviders.set(workspacePath, provider);
    provider.initialize();
  }

  return taskProviders.get(workspacePath)!;
}

/**
 * Register all task IPC handlers
 */
export function registerTaskIPCHandlers(): void {
  // Load tasks from tasks.json
  ipcMain.handle('tasks:load', async (event, workspacePath: string) => {
    try {
      const provider = getTaskProvider(workspacePath);
      const tasks = await provider.loadTasks();
      return { success: true, tasks };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Auto-detect tasks
  ipcMain.handle('tasks:detect', async (event, workspacePath: string) => {
    try {
      const provider = getTaskProvider(workspacePath);
      const tasks = await provider.autoDetectTasks();
      return { success: true, tasks };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Run a task
  ipcMain.handle('tasks:run', async (
    event,
    workspacePath: string,
    taskId: string,
    variables?: Record<string, string>
  ) => {
    try {
      const provider = getTaskProvider(workspacePath);
      const result = await provider.runTask(taskId, variables);
      return { success: result.success, ...result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Terminate a task
  ipcMain.handle('tasks:terminate', async (event, workspacePath: string, taskId: string) => {
    try {
      const provider = getTaskProvider(workspacePath);
      const success = await provider.terminateTask(taskId);
      return { success };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Get running tasks
  ipcMain.handle('tasks:getRunning', async (event, workspacePath: string) => {
    try {
      const provider = getTaskProvider(workspacePath);
      const tasks = provider.getRunningTasks();
      return { success: true, tasks };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Create a new task
  ipcMain.handle('tasks:create', async (
    event,
    workspacePath: string,
    task: TaskDefinition
  ) => {
    try {
      const provider = getTaskProvider(workspacePath);
      await provider.upsertTask(task);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Update a task
  ipcMain.handle('tasks:update', async (
    event,
    workspacePath: string,
    task: TaskDefinition
  ) => {
    try {
      const provider = getTaskProvider(workspacePath);
      await provider.upsertTask(task);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Delete a task
  ipcMain.handle('tasks:delete', async (event, workspacePath: string, taskId: string) => {
    try {
      const provider = getTaskProvider(workspacePath);
      const success = await provider.removeTask(taskId);
      return { success };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Import detected task
  ipcMain.handle('tasks:import', async (
    event,
    workspacePath: string,
    detected: DetectedTask
  ) => {
    try {
      const provider = getTaskProvider(workspacePath);
      await provider.importDetectedTasks([detected]);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Import all detected tasks
  ipcMain.handle('tasks:importAll', async (
    event,
    workspacePath: string,
    detectedTasks: DetectedTask[]
  ) => {
    try {
      const provider = getTaskProvider(workspacePath);
      await provider.importDetectedTasks(detectedTasks);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Get task result history
  ipcMain.handle('tasks:getHistory', async (event, workspacePath: string) => {
    try {
      const provider = getTaskProvider(workspacePath);
      const history = provider.getTaskHistory();
      return { success: true, history };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Clear task history
  ipcMain.handle('tasks:clearHistory', async (event, workspacePath: string) => {
    try {
      const provider = getTaskProvider(workspacePath);
      provider.clearHistory();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Dispose task provider (when closing workspace)
  ipcMain.handle('tasks:dispose', async (event, workspacePath: string) => {
    try {
      const provider = taskProviders.get(workspacePath);
      if (provider) {
        provider.dispose();
        taskProviders.delete(workspacePath);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}

/**
 * Cleanup all task providers
 */
export function cleanupTaskProviders(): void {
  for (const [path, provider] of taskProviders) {
    provider.dispose();
  }
  taskProviders.clear();
}

/**
 * Task IPC API for renderer process
 */
export const TaskIPCAPI = {
  load: (workspacePath: string) => 
    ipcRenderer.invoke('tasks:load', workspacePath),
  
  detect: (workspacePath: string) => 
    ipcRenderer.invoke('tasks:detect', workspacePath),
  
  run: (workspacePath: string, taskId: string, variables?: Record<string, string>) => 
    ipcRenderer.invoke('tasks:run', workspacePath, taskId, variables),
  
  terminate: (workspacePath: string, taskId: string) => 
    ipcRenderer.invoke('tasks:terminate', workspacePath, taskId),
  
  getRunning: (workspacePath: string) => 
    ipcRenderer.invoke('tasks:getRunning', workspacePath),
  
  create: (workspacePath: string, task: TaskDefinition) => 
    ipcRenderer.invoke('tasks:create', workspacePath, task),
  
  update: (workspacePath: string, task: TaskDefinition) => 
    ipcRenderer.invoke('tasks:update', workspacePath, task),
  
  delete: (workspacePath: string, taskId: string) => 
    ipcRenderer.invoke('tasks:delete', workspacePath, taskId),
  
  import: (workspacePath: string, detected: DetectedTask) => 
    ipcRenderer.invoke('tasks:import', workspacePath, detected),
  
  importAll: (workspacePath: string, detectedTasks: DetectedTask[]) => 
    ipcRenderer.invoke('tasks:importAll', workspacePath, detectedTasks),
  
  getHistory: (workspacePath: string) => 
    ipcRenderer.invoke('tasks:getHistory', workspacePath),
  
  clearHistory: (workspacePath: string) => 
    ipcRenderer.invoke('tasks:clearHistory', workspacePath),
  
  dispose: (workspacePath: string) => 
    ipcRenderer.invoke('tasks:dispose', workspacePath),

  // Event listeners
  onOutput: (taskId: string, callback: (data: { content: string; type: string }) => void) => {
    const handler = (event: any, data: any) => callback(data);
    ipcRenderer.on(`tasks:output:${taskId}`, handler);
    return () => ipcRenderer.removeListener(`tasks:output:${taskId}`, handler);
  },

  onStatusChange: (callback: (data: { taskId: string; status: string }) => void) => {
    const handler = (event: any, data: any) => callback(data);
    ipcRenderer.on('tasks:statusChange', handler);
    return () => ipcRenderer.removeListener('tasks:statusChange', handler);
  },

  onComplete: (callback: (result: any) => void) => {
    const handler = (event: any, data: any) => callback(data);
    ipcRenderer.on('tasks:complete', handler);
    return () => ipcRenderer.removeListener('tasks:complete', handler);
  },
};

// Need to import this at the top for the API
import { ipcRenderer } from 'electron';
