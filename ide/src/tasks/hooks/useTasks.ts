/**
 * useTasks Hook
 * React hook for managing tasks in the IDE
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  TaskDefinition,
  TaskStatus,
  DetectedTask,
  TaskOutputLine,
  TaskProblem,
  TaskResult,
} from '../types';

const { ipcRenderer } = window.require('electron');

export interface UseTasksOptions {
  workspacePath: string | null;
}

export interface UseTasksReturn {
  // State
  tasks: TaskDefinition[];
  detectedTasks: DetectedTask[];
  runningTasks: Set<string>;
  selectedTaskId: string | null;
  taskOutput: Map<string, TaskOutputLine[]>;
  taskStatus: Map<string, TaskStatus>;
  taskResults: TaskResult[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadTasks: () => Promise<void>;
  detectTasks: () => Promise<void>;
  runTask: (taskId: string, variables?: Record<string, string>) => Promise<void>;
  stopTask: (taskId: string) => Promise<void>;
  stopAllTasks: () => Promise<void>;
  selectTask: (taskId: string | null) => void;
  clearOutput: (taskId: string) => void;
  clearAllOutput: () => void;
  importDetectedTask: (detected: DetectedTask) => Promise<void>;
  getTaskOutput: (taskId: string) => TaskOutputLine[];
  getTaskProblems: (taskId: string) => TaskProblem[];
  getRecentTasks: (limit?: number) => string[];

  // Task CRUD
  createTask: (task: Omit<TaskDefinition, 'id'>) => Promise<void>;
  updateTask: (task: TaskDefinition) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
}

export function useTasks(options: UseTasksOptions): UseTasksReturn {
  const { workspacePath } = options;

  const [tasks, setTasks] = useState<TaskDefinition[]>([]);
  const [detectedTasks, setDetectedTasks] = useState<DetectedTask[]>([]);
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskOutput, setTaskOutput] = useState<Map<string, TaskOutputLine[]>>(new Map());
  const [taskStatus, setTaskStatus] = useState<Map<string, TaskStatus>>(new Map());
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outputHandlersRef = useRef<Map<string, (event: any, data: any) => void>>(new Map());

  // Load tasks from IPC
  const loadTasks = useCallback(async () => {
    if (!workspacePath) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await ipcRenderer.invoke('tasks:load', workspacePath);
      if (result.success) {
        setTasks(result.tasks);
      } else {
        setError(result.error || 'Failed to load tasks');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [workspacePath]);

  // Auto-detect tasks
  const detectTasks = useCallback(async () => {
    if (!workspacePath) return;

    setIsLoading(true);
    try {
      const result = await ipcRenderer.invoke('tasks:detect', workspacePath);
      if (result.success) {
        setDetectedTasks(result.tasks);
      }
    } catch (err) {
      console.error('Failed to detect tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspacePath]);

  // Run a task
  const runTask = useCallback(async (taskId: string, variables?: Record<string, string>) => {
    if (!workspacePath) return;

    setRunningTasks(prev => new Set(prev).add(taskId));
    setTaskStatus(prev => new Map(prev).set(taskId, 'running'));

    // Initialize output for this task
    setTaskOutput(prev => {
      const next = new Map(prev);
      next.set(taskId, []);
      return next;
    });

    try {
      // Set up output handler
      const outputChannel = `tasks:output:${taskId}`;
      const outputHandler = (event: any, data: { content: string; type: TaskOutputLine['type'] }) => {
        setTaskOutput(prev => {
          const next = new Map(prev);
          const lines = next.get(taskId) || [];
          lines.push({
            content: data.content,
            type: data.type,
            timestamp: new Date(),
          });
          next.set(taskId, lines);
          return next;
        });
      };

      ipcRenderer.on(outputChannel, outputHandler);
      outputHandlersRef.current.set(taskId, outputHandler);

      // Run the task
      const result = await ipcRenderer.invoke('tasks:run', workspacePath, taskId, variables);

      // Remove output handler
      ipcRenderer.removeListener(outputChannel, outputHandler);
      outputHandlersRef.current.delete(taskId);

      // Update status
      if (result.success) {
        setTaskStatus(prev => new Map(prev).set(taskId, 'success'));
      } else {
        setTaskStatus(prev => new Map(prev).set(taskId, 'error'));
        setError(`Task "${taskId}" failed with exit code ${result.exitCode}`);
      }

      // Store result
      setTaskResults(prev => [...prev, result]);
    } catch (err) {
      setTaskStatus(prev => new Map(prev).set(taskId, 'error'));
      setError(String(err));
    } finally {
      setRunningTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [workspacePath]);

  // Stop a running task
  const stopTask = useCallback(async (taskId: string) => {
    if (!workspacePath) return;

    try {
      await ipcRenderer.invoke('tasks:terminate', workspacePath, taskId);
      
      setTaskStatus(prev => new Map(prev).set(taskId, 'cancelled'));
      setRunningTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    } catch (err) {
      console.error('Failed to stop task:', err);
    }
  }, [workspacePath]);

  // Stop all running tasks
  const stopAllTasks = useCallback(async () => {
    for (const taskId of runningTasks) {
      await stopTask(taskId);
    }
  }, [runningTasks, stopTask]);

  // Select a task
  const selectTask = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
  }, []);

  // Clear output for a task
  const clearOutput = useCallback((taskId: string) => {
    setTaskOutput(prev => {
      const next = new Map(prev);
      next.set(taskId, []);
      return next;
    });
  }, []);

  // Clear all output
  const clearAllOutput = useCallback(() => {
    setTaskOutput(new Map());
  }, []);

  // Import detected task
  const importDetectedTask = useCallback(async (detected: DetectedTask) => {
    if (!workspacePath) return;

    try {
      const result = await ipcRenderer.invoke('tasks:import', workspacePath, detected);
      if (result.success) {
        await loadTasks();
      }
    } catch (err) {
      console.error('Failed to import task:', err);
    }
  }, [workspacePath, loadTasks]);

  // Create a new task
  const createTask = useCallback(async (task: Omit<TaskDefinition, 'id'>) => {
    if (!workspacePath) return;

    const newTask: TaskDefinition = {
      ...task,
      id: `task-${Date.now()}`,
    };

    try {
      const result = await ipcRenderer.invoke('tasks:create', workspacePath, newTask);
      if (result.success) {
        await loadTasks();
      }
    } catch (err) {
      setError(String(err));
    }
  }, [workspacePath, loadTasks]);

  // Update a task
  const updateTask = useCallback(async (task: TaskDefinition) => {
    if (!workspacePath) return;

    try {
      const result = await ipcRenderer.invoke('tasks:update', workspacePath, task);
      if (result.success) {
        await loadTasks();
      }
    } catch (err) {
      setError(String(err));
    }
  }, [workspacePath, loadTasks]);

  // Delete a task
  const deleteTask = useCallback(async (taskId: string) => {
    if (!workspacePath) return;

    try {
      const result = await ipcRenderer.invoke('tasks:delete', workspacePath, taskId);
      if (result.success) {
        await loadTasks();
        if (selectedTaskId === taskId) {
          setSelectedTaskId(null);
        }
      }
    } catch (err) {
      setError(String(err));
    }
  }, [workspacePath, loadTasks, selectedTaskId]);

  // Get output for a specific task
  const getTaskOutput = useCallback((taskId: string): TaskOutputLine[] => {
    return taskOutput.get(taskId) || [];
  }, [taskOutput]);

  // Get problems for a specific task
  const getTaskProblems = useCallback((taskId: string): TaskProblem[] => {
    const output = taskOutput.get(taskId) || [];
    return output.filter(line => line.problem).map(line => line.problem!);
  }, [taskOutput]);

  // Get recent tasks
  const recentTasks = useMemo(() => {
    return taskResults
      .slice(-10)
      .reverse()
      .map(r => r.taskId)
      .filter((id, index, arr) => arr.indexOf(id) === index);
  }, [taskResults]);

  const getRecentTasks = useCallback((limit = 5): string[] => {
    return recentTasks.slice(0, limit);
  }, [recentTasks]);

  // Load tasks when workspace changes
  useEffect(() => {
    if (workspacePath) {
      loadTasks();
      detectTasks();
    }
  }, [workspacePath, loadTasks, detectTasks]);

  // Cleanup output handlers on unmount
  useEffect(() => {
    return () => {
      outputHandlersRef.current.forEach((handler, taskId) => {
        ipcRenderer.removeListener(`tasks:output:${taskId}`, handler);
      });
    };
  }, []);

  return {
    tasks,
    detectedTasks,
    runningTasks,
    selectedTaskId,
    taskOutput,
    taskStatus,
    taskResults,
    isLoading,
    error,
    loadTasks,
    detectTasks,
    runTask,
    stopTask,
    stopAllTasks,
    selectTask,
    clearOutput,
    clearAllOutput,
    importDetectedTask,
    getTaskOutput,
    getTaskProblems,
    getRecentTasks,
    createTask,
    updateTask,
    deleteTask,
  };
}

export default useTasks;
