/**
 * Task Provider
 * Manages task definitions, auto-detection, and execution
 */

import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import {
  TaskDefinition,
  TasksConfig,
  RunningTask,
  TaskResult,
  TaskStatus,
  DetectedTask,
  TaskProblem,
  ProblemMatcher,
  TaskOutputLine,
  TaskGroup,
} from './types';
import { AutoDetectors } from './utils/AutoDetectors';
import { problemMatcherService } from './utils/ProblemMatcher';

export interface TaskProviderOptions {
  projectPath: string;
  onOutput?: (taskId: string, line: TaskOutputLine) => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  onTaskComplete?: (result: TaskResult) => void;
}

export class TaskProvider extends EventEmitter {
  private projectPath: string;
  private tasksConfig: TasksConfig | null = null;
  private runningTasks = new Map<string, RunningTask>();
  private taskHistory: TaskResult[] = [];
  private autoDetectors: AutoDetectors;
  private problemMatcher = problemMatcherService;
  private onOutput?: (taskId: string, line: TaskOutputLine) => void;
  private onStatusChange?: (taskId: string, status: TaskStatus) => void;
  private onTaskComplete?: (result: TaskResult) => void;
  private configWatcher: fs.FSWatcher | null = null;

  constructor(options: TaskProviderOptions) {
    super();
    this.projectPath = options.projectPath;
    this.onOutput = options.onOutput;
    this.onStatusChange = options.onStatusChange;
    this.onTaskComplete = options.onTaskComplete;
    this.autoDetectors = new AutoDetectors();

  }

  /**
   * Initialize the task provider
   */
  public async initialize(): Promise<void> {
    await this.loadTasks();
    this.setupConfigWatcher();
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.terminateAllTasks();
    if (this.configWatcher) {
      this.configWatcher.close();
      this.configWatcher = null;
    }
    this.removeAllListeners();
  }

  // ============ Task Loading ============

  /**
   * Load tasks from .traitor/tasks.json
   */
  public async loadTasks(): Promise<TaskDefinition[]> {
    const tasksPath = path.join(this.projectPath, '.traitor', 'tasks.json');

    try {
      if (fs.existsSync(tasksPath)) {
        const content = fs.readFileSync(tasksPath, 'utf-8');
        this.tasksConfig = JSON.parse(content);
        this.emit('tasksLoaded', this.tasksConfig!.tasks);
        return this.tasksConfig!.tasks;
      }
    } catch (error) {
      console.error('Failed to load tasks.json:', error);
    }

    this.tasksConfig = { version: '2.0.0', tasks: [] };
    return [];
  }

  /**
   * Save tasks to .traitor/tasks.json
   */
  public async saveTasks(config: TasksConfig): Promise<void> {
    const traitorDir = path.join(this.projectPath, '.traitor');
    const tasksPath = path.join(traitorDir, 'tasks.json');

    try {
      if (!fs.existsSync(traitorDir)) {
        fs.mkdirSync(traitorDir, { recursive: true });
      }

      fs.writeFileSync(tasksPath, JSON.stringify(config, null, 2), 'utf-8');
      this.tasksConfig = config;
      this.emit('tasksSaved', config);
    } catch (error) {
      console.error('Failed to save tasks.json:', error);
      throw error;
    }
  }

  /**
   * Watch tasks.json for changes
   */
  private setupConfigWatcher(): void {
    const tasksPath = path.join(this.projectPath, '.traitor', 'tasks.json');

    try {
      this.configWatcher = fs.watch(tasksPath, (eventType) => {
        if (eventType === 'change') {
          this.loadTasks();
        }
      });
    } catch (error) {
      // File doesn't exist yet, that's ok
    }
  }

  // ============ Task Definitions ============

  /**
   * Get all defined tasks
   */
  public getTasks(): TaskDefinition[] {
    return this.tasksConfig?.tasks || [];
  }

  /**
   * Get task by ID
   */
  public getTask(id: string): TaskDefinition | undefined {
    return this.tasksConfig?.tasks.find(t => t.id === id);
  }

  /**
   * Get tasks by group
   */
  public getTasksByGroup(group: TaskGroup): TaskDefinition[] {
    return (this.tasksConfig?.tasks || []).filter(t => t.group === group);
  }

  /**
   * Add or update a task
   */
  public async upsertTask(task: TaskDefinition): Promise<void> {
    const config = this.tasksConfig || { version: '2.0.0', tasks: [] };
    const index = config.tasks.findIndex(t => t.id === task.id);

    if (index >= 0) {
      config.tasks[index] = task;
    } else {
      config.tasks.push(task);
    }

    await this.saveTasks(config);
  }

  /**
   * Remove a task
   */
  public async removeTask(id: string): Promise<boolean> {
    const config = this.tasksConfig;
    if (!config) return false;

    const index = config.tasks.findIndex(t => t.id === id);
    if (index >= 0) {
      config.tasks.splice(index, 1);
      await this.saveTasks(config);
      return true;
    }
    return false;
  }

  // ============ Auto-Detection ============

  /**
   * Auto-detect tasks from build tools
   */
  public async autoDetectTasks(): Promise<DetectedTask[]> {
    const detected: DetectedTask[] = [];

    for (const detector of this.autoDetectors.getDetectors()) {
      try {
        const tasks = await detector.detect(this.projectPath);
        detected.push(...tasks);
      } catch (error) {
        console.warn(`Auto-detect failed for ${detector.name}:`, error);
      }
    }

    return detected;
  }

  /**
   * Import auto-detected tasks into tasks.json
   */
  public async importDetectedTasks(detectedTasks: DetectedTask[]): Promise<void> {
    const config = this.tasksConfig || { version: '2.0.0', tasks: [] };

    for (const detected of detectedTasks) {
      const id = `auto-${detected.source}-${detected.label.replace(/\s+/g, '-').toLowerCase()}`;
      
      // Skip if task already exists
      if (config.tasks.some(t => t.id === id)) continue;

      const task: TaskDefinition = {
        id,
        label: detected.label,
        type: detected.type,
        command: detected.command,
        args: detected.args,
        group: detected.group,
        hide: false,
      };

      config.tasks.push(task);
    }

    await this.saveTasks(config);
  }

  // ============ Task Execution ============

  /**
   * Run a task by ID
   */
  public async runTask(id: string, variables?: Record<string, string>): Promise<TaskResult> {
    const task = this.getTask(id);
    if (!task) {
      throw new Error(`Task "${id}" not found`);
    }

    return this.executeTask(task, variables);
  }

  /**
   * Execute a task definition
   */
  public async executeTask(
    task: TaskDefinition,
    variables?: Record<string, string>
  ): Promise<TaskResult> {
    // Check if already running
    if (this.runningTasks.has(task.id)) {
      throw new Error(`Task "${task.label}" is already running`);
    }

    // Handle dependencies
    if (task.dependsOn && task.dependsOn.length > 0) {
      await this.runDependencies(task.dependsOn, variables);
    }

    const terminalId = `task-${task.id}-${Date.now()}`;
    const startTime = Date.now();

    // Apply platform-specific overrides
    const platformTask = this.applyPlatformOverrides(task);

    // Substitute variables
    const resolvedTask = this.substituteVariables(platformTask, variables);

    const runningTask: RunningTask = {
      id: task.id,
      definition: resolvedTask,
      startTime: new Date(),
      status: 'running',
      terminalId,
    };

    this.runningTasks.set(task.id, runningTask);
    this.updateStatus(task.id, 'running');

    return new Promise((resolve, reject) => {
      const cwd = resolvedTask.options?.cwd || this.projectPath;
      const env = { ...process.env, ...resolvedTask.options?.env };

      // Build command
      let command = resolvedTask.command;
      const args = resolvedTask.args || [];

      // Handle shell tasks
      const useShell = resolvedTask.type === 'shell' ? true : typeof resolvedTask.options?.shell === 'object' ? true : resolvedTask.options?.shell;

      if (useShell) {
        const shellCmd = resolvedTask.options?.shell;
        if (shellCmd) {
          command = shellCmd.executable;
          args.unshift(...(shellCmd.args || []));
        }
      }

      // Spawn the process
      const child = spawn(command, args, {
        cwd,
        env,
        shell: useShell,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      runningTask.pid = child.pid;
      runningTask.process = child;

      const problems: TaskProblem[] = [];
      const matchers = this.getProblemMatchers(resolvedTask.problemMatcher);

      // Handle stdout
      if (!child.stdout) return;
      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            // Try to match problem patterns
            for (const matcher of matchers) {
              const problem = this.problemMatcher.match(line, matcher, this.projectPath);
              if (problem) {
                problems.push(problem);
              }
            }

            this.emitOutput(task.id, {
              content: line,
              type: 'stdout',
              timestamp: new Date(),
              problem: problems.find(p => p.raw === line),
            });
          }
        }
      });

      // Handle stderr
      if (!child.stderr) return;
      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            // Try to match problem patterns
            for (const matcher of matchers) {
              const problem = this.problemMatcher.match(line, matcher, this.projectPath);
              if (problem) {
                problems.push(problem);
              }
            }

            this.emitOutput(task.id, {
              content: line,
              type: 'stderr',
              timestamp: new Date(),
              problem: problems.find(p => p.raw === line),
            });
          }
        }
      });

      // Handle process exit
      child.on('close', (code) => {
        const executionTime = Date.now() - startTime;
        const success = code === 0;

        runningTask.status = success ? 'success' : 'error';
        runningTask.exitCode = code || 0;

        this.runningTasks.delete(task.id);
        this.updateStatus(task.id, runningTask.status);

        const result: TaskResult = {
          taskId: task.id,
          success,
          exitCode: code || 0,
          executionTime,
          problems,
        };

        this.taskHistory.push(result);
        this.emit('taskComplete', result);
        this.onTaskComplete?.(result);

        resolve(result);
      });

      // Handle errors
      child.on('error', (error) => {
        this.runningTasks.delete(task.id);
        this.updateStatus(task.id, 'error');

        this.emitOutput(task.id, {
          content: `Error: ${error.message}`,
          type: 'error',
          timestamp: new Date(),
        });

        reject(error);
      });
    });
  }

  /**
   * Run task dependencies
   */
  private async runDependencies(
    dependencies: string[] | { id: string; dependsOrder?: 'parallel' | 'sequence' }[],
    variables?: Record<string, string>
  ): Promise<void> {
    // Normalize dependencies
    const deps = dependencies.map(d => 
      typeof d === 'string' ? { id: d, dependsOrder: 'sequence' as const } : d
    );

    const firstOrder = deps[0]?.dependsOrder || 'sequence';

    if (firstOrder === 'parallel') {
      // Run in parallel
      await Promise.all(deps.map(dep => this.runTask(dep.id, variables).catch(console.error)));
    } else {
      // Run sequentially
      for (const dep of deps) {
        await this.runTask(dep.id, variables);
      }
    }
  }

  /**
   * Terminate a running task
   */
  public async terminateTask(id: string): Promise<boolean> {
    const task = this.runningTasks.get(id);
    if (!task) return false;

    if (task.process) {
      try {
        // Try graceful termination first
        task.process.kill('SIGTERM');

        // Force kill after timeout
        setTimeout(() => {
          if (!task.process.killed) {
            task.process.kill('SIGKILL');
          }
        }, 5000);

        task.status = 'cancelled';
        this.updateStatus(id, 'cancelled');
        this.runningTasks.delete(id);

        return true;
      } catch (error) {
        console.error('Failed to terminate task:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Terminate all running tasks
   */
  public terminateAllTasks(): void {
    for (const [id] of this.runningTasks) {
      this.terminateTask(id);
    }
  }

  // ============ Task Queries ============

  /**
   * Get all running tasks
   */
  public getRunningTasks(): RunningTask[] {
    return Array.from(this.runningTasks.values());
  }

  /**
   * Check if a task is running
   */
  public isTaskRunning(id: string): boolean {
    return this.runningTasks.has(id);
  }

  /**
   * Get task status
   */
  public getTaskStatus(id: string): TaskStatus | null {
    return this.runningTasks.get(id)?.status || null;
  }

  /**
   * Get task history
   */
  public getTaskHistory(): TaskResult[] {
    return [...this.taskHistory];
  }

  /**
   * Clear task history
   */
  public clearHistory(): void {
    this.taskHistory = [];
  }

  // ============ Helper Methods ============

  private applyPlatformOverrides(task: TaskDefinition): TaskDefinition {
    const platform = process.platform;
    let override: Partial<TaskDefinition> = {};

    if (platform === 'win32' && task.windows) {
      override = task.windows;
    } else if (platform === 'darwin' && task.osx) {
      override = task.osx;
    } else if (platform === 'linux' && task.linux) {
      override = task.linux;
    }

    return { ...task, ...override };
  }

  private substituteVariables(
    task: TaskDefinition,
    variables?: Record<string, string>
  ): TaskDefinition {
    const vars = {
      '${workspaceFolder}': this.projectPath,
      '${workspaceFolderBasename}': path.basename(this.projectPath),
      '${cwd}': process.cwd(),
      '${env:PATH}': process.env.PATH || '',
      ...Object.fromEntries(
        Object.entries(process.env).map(([k, v]) => [`\${env:${k}}`, v || ''])
      ),
      ...variables,
    };

    const substitute = (str: string): string => {
      let result = str;
      for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
      }
      return result;
    };

    return {
      ...task,
      command: substitute(task.command),
      args: task.args?.map(substitute),
      options: {
        ...task.options,
        cwd: task.options?.cwd ? substitute(task.options.cwd) : undefined,
      },
    };
  }

  private getProblemMatchers(
    matchers: TaskDefinition['problemMatcher']
  ): ProblemMatcher[] {
    if (!matchers) return [];

    const result: ProblemMatcher[] = [];
    const matcherArray = Array.isArray(matchers) ? matchers : [matchers];

    for (const matcher of matcherArray) {
      if (typeof matcher === 'string') {
        // Try to find predefined matcher
        const predefined = this.tasksConfig?.problemMatchers?.find(m => m.name === matcher);
        if (predefined) {
          result.push(predefined);
        } else {
          // Use built-in matchers
          const builtIn = this.problemMatcher.getBuiltInMatcher(matcher);
          if (builtIn) {
            result.push(builtIn);
          }
        }
      } else {
        result.push(matcher);
      }
    }

    return result;
  }

  private updateStatus(taskId: string, status: TaskStatus): void {
    this.emit('statusChange', taskId, status);
    this.onStatusChange?.(taskId, status);
  }

  private emitOutput(taskId: string, line: TaskOutputLine): void {
    this.emit('output', taskId, line);
    this.onOutput?.(taskId, line);
  }
}
