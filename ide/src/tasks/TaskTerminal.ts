/**
 * Task Terminal
 * Specialized terminal for task output with problem matching
 */

import { EventEmitter } from 'events';
import { TaskOutputLine, TaskProblem, ProblemMatcher } from './types';
import { problemMatcherService } from './utils/ProblemMatcher';

export interface TaskTerminalOptions {
  id: string;
  taskName: string;
  maxLines?: number;
  colorize?: boolean;
}

export class TaskTerminal extends EventEmitter {
  public readonly id: string;
  public readonly taskName: string;
  private lines: TaskOutputLine[] = [];
  private maxLines: number;
  private colorize: boolean;
  private problemMatcher = problemMatcherService;
  private matchers: ProblemMatcher[] = [];
  private isActive = true;

  constructor(options: TaskTerminalOptions) {
    super();
    this.id = options.id;
    this.taskName = options.taskName;
    this.maxLines = options.maxLines || 10000;
    this.colorize = options.colorize ?? true;

  }

  /**
   * Add a problem matcher
   */
  public addMatcher(matcher: ProblemMatcher): void {
    this.matchers.push(matcher);
  }

  /**
   * Set problem matchers
   */
  public setMatchers(matchers: ProblemMatcher[]): void {
    this.matchers = matchers;
  }

  /**
   * Write a line to the terminal
   */
  public write(content: string, type: TaskOutputLine['type'] = 'stdout'): void {
    const line: TaskOutputLine = {
      content,
      type,
      timestamp: new Date(),
    };

    // Try to match problem patterns
    for (const matcher of this.matchers) {
      const problem = this.problemMatcher.match(content, matcher, '');
      if (problem) {
        line.problem = problem;
        break;
      }
    }

    this.lines.push(line);

    // Trim old lines
    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines);
    }

    this.emit('line', line);
  }

  /**
   * Write raw output (may contain multiple lines)
   */
  public writeRaw(data: string, type: TaskOutputLine['type'] = 'stdout'): void {
    const lines = data.split('\n');
    for (const line of lines) {
      if (line.trim() || type === 'stdout') {
        this.write(line, type);
      }
    }
  }

  /**
   * Write info message
   */
  public info(message: string): void {
    this.write(message, 'info');
  }

  /**
   * Write error message
   */
  public error(message: string): void {
    this.write(message, 'error');
  }

  /**
   * Write success message
   */
  public success(message: string): void {
    this.write(message, 'success');
  }

  /**
   * Clear the terminal
   */
  public clear(): void {
    this.lines = [];
    this.emit('clear');
  }

  /**
   * Get all lines
   */
  public getLines(): TaskOutputLine[] {
    return [...this.lines];
  }

  /**
   * Get lines as formatted text
   */
  public getText(): string {
    return this.lines.map(l => l.content).join('\n');
  }

  /**
   * Get lines filtered by type
   */
  public getLinesByType(type: TaskOutputLine['type']): TaskOutputLine[] {
    return this.lines.filter(l => l.type === type);
  }

  /**
   * Get all detected problems
   */
  public getProblems(): TaskProblem[] {
    return this.lines
      .filter(l => l.problem)
      .map(l => l.problem!);
  }

  /**
   * Get error count
   */
  public getErrorCount(): number {
    return this.getProblems().filter(p => p.severity === 'error').length;
  }

  /**
   * Get warning count
   */
  public getWarningCount(): number {
    return this.getProblems().filter(p => p.severity === 'warning').length;
  }

  /**
   * Format line with ANSI colors
   */
  public formatLine(line: TaskOutputLine): string {
    if (!this.colorize) {
      return line.content;
    }

    const colors: Record<TaskOutputLine['type'], string> = {
      stdout: '\x1b[0m',  // Reset
      stderr: '\x1b[31m', // Red
      info: '\x1b[36m',   // Cyan
      error: '\x1b[31m',  // Red
      success: '\x1b[32m', // Green
    };

    const reset = '\x1b[0m';
    return `${colors[line.type]}${line.content}${reset}`;
  }

  /**
   * Get formatted content for display
   */
  public getFormattedContent(): string {
    return this.lines.map(l => this.formatLine(l)).join('\n');
  }

  /**
   * Search for text in output
   */
  public search(query: string): TaskOutputLine[] {
    const regex = new RegExp(query, 'i');
    return this.lines.filter(l => regex.test(l.content));
  }

  /**
   * Dispose the terminal
   */
  public dispose(): void {
    this.isActive = false;
    this.removeAllListeners();
  }

  /**
   * Check if terminal is active
   */
  public get active(): boolean {
    return this.isActive;
  }

  /**
   * Get line count
   */
  public get lineCount(): number {
    return this.lines.length;
  }

  /**
   * Create clickable link for a problem
   */
  public static createFileLink(problem: TaskProblem): string {
    const location = problem.column
      ? `${problem.line}:${problem.column}`
      : `${problem.line}`;
    return `\x1b]8;;file://${problem.file}:${problem.line}\x1b\\${problem.file}:${location}\x1b]8;;\x1b\\`;
  }
}

/**
 * Task Terminal Manager
 * Manages multiple task terminals
 */
export class TaskTerminalManager extends EventEmitter {
  private terminals = new Map<string, TaskTerminal>();
  private activeTerminalId: string | null = null;

  /**
   * Create a new task terminal
   */
  public create(id: string, taskName: string, options?: Partial<TaskTerminalOptions>): TaskTerminal {
    const terminal = new TaskTerminal({
      id,
      taskName,
      maxLines: options?.maxLines || 10000,
      colorize: options?.colorize ?? true,
    });

    this.terminals.set(id, terminal);
    
    // Forward events
    terminal.on('line', (line) => {
      this.emit('line', id, line);
    });

    terminal.on('clear', () => {
      this.emit('clear', id);
    });

    this.emit('terminalCreated', id, terminal);
    
    return terminal;
  }

  /**
   * Get a terminal by ID
   */
  public get(id: string): TaskTerminal | undefined {
    return this.terminals.get(id);
  }

  /**
   * Get all terminals
   */
  public getAll(): TaskTerminal[] {
    return Array.from(this.terminals.values());
  }

  /**
   * Get terminal IDs
   */
  public getIds(): string[] {
    return Array.from(this.terminals.keys());
  }

  /**
   * Check if terminal exists
   */
  public has(id: string): boolean {
    return this.terminals.has(id);
  }

  /**
   * Remove a terminal
   */
  public remove(id: string): boolean {
    const terminal = this.terminals.get(id);
    if (terminal) {
      terminal.dispose();
      this.terminals.delete(id);
      
      if (this.activeTerminalId === id) {
        this.activeTerminalId = null;
      }
      
      this.emit('terminalRemoved', id);
      return true;
    }
    return false;
  }

  /**
   * Set active terminal
   */
  public setActive(id: string): void {
    if (this.terminals.has(id)) {
      this.activeTerminalId = id;
      this.emit('activeChanged', id);
    }
  }

  /**
   * Get active terminal
   */
  public getActive(): TaskTerminal | undefined {
    return this.activeTerminalId ? this.terminals.get(this.activeTerminalId) : undefined;
  }

  /**
   * Get active terminal ID
   */
  public getActiveId(): string | null {
    return this.activeTerminalId;
  }

  /**
   * Clear all terminals
   */
  public clearAll(): void {
    for (const terminal of this.terminals.values()) {
      terminal.clear();
    }
  }

  /**
   * Dispose all terminals
   */
  public dispose(): void {
    for (const terminal of this.terminals.values()) {
      terminal.dispose();
    }
    this.terminals.clear();
    this.activeTerminalId = null;
    this.removeAllListeners();
  }

  /**
   * Get total line count across all terminals
   */
  public getTotalLineCount(): number {
    return Array.from(this.terminals.values()).reduce((sum, t) => sum + t.lineCount, 0);
  }

  /**
   * Get all problems across all terminals
   */
  public getAllProblems(): Array<{ terminalId: string; problem: TaskProblem }> {
    const problems: Array<{ terminalId: string; problem: TaskProblem }> = [];
    
    for (const [id, terminal] of this.terminals) {
      for (const problem of terminal.getProblems()) {
        problems.push({ terminalId: id, problem });
      }
    }
    
    return problems;
  }

  /**
   * Search across all terminals
   */
  public searchAll(query: string): Array<{ terminalId: string; lines: TaskOutputLine[] }> {
    const results: Array<{ terminalId: string; lines: TaskOutputLine[] }> = [];
    
    for (const [id, terminal] of this.terminals) {
      const lines = terminal.search(query);
      if (lines.length > 0) {
        results.push({ terminalId: id, lines });
      }
    }
    
    return results;
  }
}
