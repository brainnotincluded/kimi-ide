/**
 * Task Runner System
 * Inspired by VS Code tasks.json
 */

// Types
export * from './types';

// Core
export { TaskProvider, TaskProviderOptions } from './TaskProvider';
export { TaskTerminal, TaskTerminalManager, TaskTerminalOptions } from './TaskTerminal';

// Utils
export { AutoDetectors, ProblemMatcher } from './utils';

// React components
export { TasksPanel } from './ui/TasksPanel';
export { TaskStatusBar } from './ui/TaskStatusBar';
export { TaskOutputPanel } from './ui/TaskOutputPanel';

// Hooks
export { useTasks, UseTasksOptions, UseTasksReturn } from './hooks/useTasks';

// IPC Handlers
export { registerTaskIPCHandlers, TaskIPCAPI } from './ipc/TaskIPC';
