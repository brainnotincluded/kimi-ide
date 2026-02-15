/**
 * Task Runner System - Type Definitions
 * Inspired by VS Code tasks.json
 */

export type TaskType = 'shell' | 'process';
export type TaskGroup = 'build' | 'test' | 'run' | 'none';
export type TaskStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled';

/** Pattern for problem matching */
export interface ProblemPattern {
  /** Regular expression to match */
  regexp: string;
  /** Which group captures the file path */
  file?: number;
  /** Which group captures the line number */
  line?: number;
  /** Which group captures the column number */
  column?: number;
  /** Which group captures the error code */
  code?: number;
  /** Which group captures the error severity (error, warning, info) */
  severity?: number;
  /** Which group captures the message */
  message?: number;
}

/** Problem matcher configuration */
export interface ProblemMatcher {
  /** Unique name for this matcher */
  name: string;
  /** Pattern(s) to match */
  pattern: ProblemPattern | ProblemPattern[];
  /** File location (relative to workspace) */
  fileLocation?: 'relative' | 'absolute' | string[];
  /** Background monitoring for watching tasks */
  background?: {
    activeOnStart: boolean;
    beginsPattern: string;
    endsPattern: string;
  };
}

/** Task execution options */
export interface TaskOptions {
  /** Current working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Execute in shell */
  shell?: {
    executable: string;
    args?: string[];
  };
}

/** Task dependency */
export interface TaskDependency {
  /** Task ID or label */
  id: string;
  /** Wait for this task to complete before running */
  dependsOrder?: 'parallel' | 'sequence';
}

/** Task presentation options */
export interface PresentationOptions {
  /** Reveal the terminal when task starts */
  reveal?: 'always' | 'silent' | 'never';
  /** Focus the terminal */
  focus?: boolean;
  /** Show the task panel */
  panel?: 'shared' | 'dedicated' | 'new';
  /** Clear the terminal before running */
  clear?: boolean;
  /** Close the terminal on successful completion */
  close?: boolean;
}

/** Task definition - matches VS Code tasks.json format */
export interface TaskDefinition {
  /** Unique identifier for the task */
  id: string;
  /** Display label */
  label: string;
  /** Task type */
  type: TaskType;
  /** Command to execute */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Execution options */
  options?: TaskOptions;
  /** Task group (build, test, run, none) */
  group?: TaskGroup;
  /** Tasks that must complete before this one */
  dependsOn?: string[] | TaskDependency[];
  /** Problem matchers for parsing output */
  problemMatcher?: string | ProblemMatcher | (string | ProblemMatcher)[];
  /** Presentation options */
  presentation?: PresentationOptions;
  /** Hide this task from the UI */
  hide?: boolean;
  /** Task is the default for its group */
  isDefault?: boolean;
  /** Windows-specific options */
  windows?: Partial<TaskDefinition>;
  /** macOS-specific options */
  osx?: Partial<TaskDefinition>;
  /** Linux-specific options */
  linux?: Partial<TaskDefinition>;
}

/** Tasks configuration from .traitor/tasks.json */
export interface TasksConfig {
  /** Version of the configuration */
  version: '2.0.0';
  /** Global task options */
  options?: TaskOptions;
  /** Global problem matchers */
  problemMatchers?: ProblemMatcher[];
  /** Task definitions */
  tasks: TaskDefinition[];
  /** Input variables */
  inputs?: TaskInput[];
}

/** Input variable for tasks */
export interface TaskInput {
  /** Input ID */
  id: string;
  /** Input type */
  type: 'promptString' | 'pickString' | 'command';
  /** Input description */
  description: string;
  /** Default value */
  default?: string;
  /** Options for pickString */
  options?: string[];
}

/** Running task information */
export interface RunningTask {
  /** Task ID */
  id: string;
  /** Task definition */
  definition: TaskDefinition;
  /** Process ID */
  pid?: number;
  /** Start time */
  startTime: Date;
  /** Current status */
  status: TaskStatus;
  /** Exit code */
  exitCode?: number;
  /** Terminal ID for output */
  terminalId: string;
  /** Process handle */
  process?: any;
}

/** Task execution result */
export interface TaskResult {
  /** Task ID */
  taskId: string;
  /** Success status */
  success: boolean;
  /** Exit code */
  exitCode: number;
  /** Execution time in ms */
  executionTime: number;
  /** Parsed problems */
  problems: TaskProblem[];
}

/** Problem detected in task output */
export interface TaskProblem {
  /** File path */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column?: number;
  /** Error severity */
  severity: 'error' | 'warning' | 'info';
  /** Error code */
  code?: string;
  /** Error message */
  message: string;
  /** Original matched text */
  raw: string;
}

/** Detected task from build tools */
export interface DetectedTask {
  /** Task label */
  label: string;
  /** Task type */
  type: TaskType;
  /** Command to run */
  command: string;
  /** Arguments */
  args?: string[];
  /** Task group */
  group: TaskGroup;
  /** Source of detection (npm, cargo, etc.) */
  source: string;
  /** Task description */
  description?: string;
}

/** Task output line */
export interface TaskOutputLine {
  /** Line content */
  content: string;
  /** Line type */
  type: 'stdout' | 'stderr' | 'info' | 'error' | 'success';
  /** Timestamp */
  timestamp: Date;
  /** Associated problem if any */
  problem?: TaskProblem;
}

/** Task terminal options */
export interface TaskTerminalOptions {
  /** Terminal ID */
  id: string;
  /** Task name for display */
  taskName: string;
  /** Auto-focus on output */
  autoFocus?: boolean;
}

/** Auto-detect configuration for build tools */
export interface AutoDetectConfig {
  /** Build tool name */
  name: string;
  /** Configuration files to detect */
  configFiles: string[];
  /** Task detection function */
  detect: (projectPath: string) => Promise<DetectedTask[]> | DetectedTask[];
}
