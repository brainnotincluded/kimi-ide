/**
 * Problems Manager
 * IDE Kimi IDE - Central manager for diagnostics/problems panel
 */

import { EventEmitter } from '../languages/core/types';
import { Diagnostic, DiagnosticSeverity } from '../languages/core/types';
import {
  ProblemItemData,
  ProblemsChangedEvent,
  ProblemsCount,
  ProblemsFilter,
  DEFAULT_FILTER,
  CodeAction,
  generateProblemId,
  calculateCounts,
  LanguageDiagnosticsProvider,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface FileDiagnostics {
  /** File path */
  file: string;
  /** Associated diagnostics */
  diagnostics: Diagnostic[];
  /** Source of diagnostics */
  source: string;
  /** Timestamp of last update */
  timestamp: number;
}

export interface ProblemsManagerOptions {
  /** Workspace root path */
  workspaceRoot?: string;
  /** Default filter settings */
  defaultFilter?: ProblemsFilter;
}

// ============================================================================
// Problems Manager
// ============================================================================

export class ProblemsManager {
  /** Map of file path to diagnostics */
  private fileDiagnostics = new Map<string, FileDiagnostics[]>();
  
  /** Registered language providers */
  private languageProviders = new Map<string, LanguageDiagnosticsProvider[]>();
  
  /** Current filter settings */
  private filter: ProblemsFilter;
  
  /** Event emitters */
  private onProblemsChangedEmitter = new EventEmitter<ProblemsChangedEvent>();
  private onFileValidationStartedEmitter = new EventEmitter<string>();
  private onFileValidationFinishedEmitter = new EventEmitter<string>();
  
  /** Workspace root */
  private workspaceRoot: string;

  constructor(options: ProblemsManagerOptions = {}) {
    this.workspaceRoot = options.workspaceRoot || process.cwd();
    this.filter = options.defaultFilter || { ...DEFAULT_FILTER };
  }

  // ============================================================================
  // Diagnostics Management
  // ============================================================================

  /**
   * Publish diagnostics for a file
   * @param filePath - Absolute file path
   * @param diagnostics - Array of diagnostics
   * @param source - Source of diagnostics (e.g., 'eslint', 'tsc')
   */
  publishDiagnostics(filePath: string, diagnostics: Diagnostic[], source: string): void {
    // Normalize file path
    const normalizedPath = this.normalizePath(filePath);
    
    // Get existing diagnostics for this file
    const existing = this.fileDiagnostics.get(normalizedPath) || [];
    
    // Remove diagnostics from the same source
    const filtered = existing.filter(d => d.source !== source);
    
    // Add new diagnostics
    if (diagnostics.length > 0) {
      filtered.push({
        file: normalizedPath,
        diagnostics: [...diagnostics],
        source,
        timestamp: Date.now(),
      });
    }
    
    // Update or delete
    if (filtered.length > 0) {
      this.fileDiagnostics.set(normalizedPath, filtered);
    } else {
      this.fileDiagnostics.delete(normalizedPath);
    }
    
    // Emit change event
    this.emitProblemsChanged(normalizedPath);
  }

  /**
   * Clear diagnostics for a file
   * @param filePath - File path, or undefined to clear all
   * @param source - Source to clear, or undefined to clear all sources
   */
  clearDiagnostics(filePath?: string, source?: string): void {
    if (!filePath) {
      // Clear all diagnostics
      this.fileDiagnostics.clear();
      this.emitProblemsChanged();
      return;
    }

    const normalizedPath = this.normalizePath(filePath);
    
    if (!source) {
      // Clear all diagnostics for this file
      this.fileDiagnostics.delete(normalizedPath);
    } else {
      // Clear diagnostics from specific source
      const existing = this.fileDiagnostics.get(normalizedPath);
      if (existing) {
        const filtered = existing.filter(d => d.source !== source);
        if (filtered.length > 0) {
          this.fileDiagnostics.set(normalizedPath, filtered);
        } else {
          this.fileDiagnostics.delete(normalizedPath);
        }
      }
    }
    
    this.emitProblemsChanged(normalizedPath);
  }

  /**
   * Get diagnostics for a specific file
   */
  getDiagnostics(filePath: string): ProblemItemData[] {
    const normalizedPath = this.normalizePath(filePath);
    return this.convertToProblemItems(normalizedPath);
  }

  /**
   * Get all diagnostics
   */
  getAllDiagnostics(): ProblemItemData[] {
    const allProblems: ProblemItemData[] = [];
    
    for (const filePath of Array.from(this.fileDiagnostics.keys())) {
      allProblems.push(...this.convertToProblemItems(filePath));
    }
    
    return allProblems;
  }

  /**
   * Get filtered diagnostics based on current filter settings
   */
  getFilteredDiagnostics(): ProblemItemData[] {
    const all = this.getAllDiagnostics();
    return this.applyFilter(all);
  }

  // ============================================================================
  // File Change Handling
  // ============================================================================

  /**
   * Handle file change - triggers validation from all language providers
   * @param filePath - Changed file path
   * @param content - Optional file content
   */
  async onFileChange(filePath: string, content?: string): Promise<void> {
    const normalizedPath = this.normalizePath(filePath);
    const languageId = this.detectLanguageId(normalizedPath);
    
    this.onFileValidationStartedEmitter.emit(normalizedPath);
    
    try {
      // Get providers for this language
      const providers = this.languageProviders.get(languageId) || [];
      
      // Run diagnostics from all providers
      await Promise.all(
        providers.map(async (provider) => {
          try {
            const diagnostics = await provider.getDiagnostics(normalizedPath, content);
            this.publishDiagnostics(normalizedPath, diagnostics, provider.name);
          } catch (error) {
            console.error(`[ProblemsManager] Provider ${provider.name} failed:`, error);
          }
        })
      );
    } finally {
      this.onFileValidationFinishedEmitter.emit(normalizedPath);
    }
  }

  /**
   * Handle file save - triggers immediate validation
   */
  async onFileSave(filePath: string, content?: string): Promise<void> {
    // Same as change for now, but could have different behavior
    await this.onFileChange(filePath, content);
  }

  /**
   * Handle file delete - clears diagnostics
   */
  onFileDelete(filePath: string): void {
    this.clearDiagnostics(filePath);
  }

  // ============================================================================
  // Language Provider Registration
  // ============================================================================

  /**
   * Register a language diagnostics provider
   */
  registerLanguageProvider(provider: LanguageDiagnosticsProvider): void {
    const existing = this.languageProviders.get(provider.languageId) || [];
    
    // Check for duplicate
    if (existing.some(p => p.name === provider.name)) {
      console.warn(`[ProblemsManager] Provider ${provider.name} already registered for ${provider.languageId}`);
      return;
    }
    
    existing.push(provider);
    this.languageProviders.set(provider.languageId, existing);
  }

  /**
   * Unregister a language provider
   */
  unregisterLanguageProvider(languageId: string, providerName: string): void {
    const existing = this.languageProviders.get(languageId);
    if (existing) {
      const filtered = existing.filter(p => p.name !== providerName);
      if (filtered.length > 0) {
        this.languageProviders.set(languageId, filtered);
      } else {
        this.languageProviders.delete(languageId);
      }
    }
  }

  // ============================================================================
  // Code Actions
  // ============================================================================

  /**
   * Get code actions for a file at a specific range
   */
  async getCodeActions(filePath: string, range: { start: { line: number; character: number }; end: { line: number; character: number } }): Promise<CodeAction[]> {
    const normalizedPath = this.normalizePath(filePath);
    const languageId = this.detectLanguageId(normalizedPath);
    const providers = this.languageProviders.get(languageId) || [];
    
    const actions: CodeAction[] = [];
    
    // Get diagnostics at this range
    const fileDiags = this.fileDiagnostics.get(normalizedPath) || [];
    const allDiagnostics = fileDiags.flatMap(fd => fd.diagnostics);
    const rangeDiagnostics = allDiagnostics.filter(d => 
      this.rangeIntersects(d.range, range)
    );
    
    // Get code actions from providers
    for (const provider of providers) {
      if (provider.getCodeActions) {
        try {
          const providerActions = await provider.getCodeActions(
            normalizedPath,
            range as any,
            rangeDiagnostics
          );
          actions.push(...providerActions);
        } catch (error) {
          console.error(`[ProblemsManager] Failed to get code actions from ${provider.name}:`, error);
        }
      }
    }
    
    return actions;
  }

  // ============================================================================
  // Filter Management
  // ============================================================================

  /**
   * Update filter settings
   */
  setFilter(filter: Partial<ProblemsFilter>): void {
    this.filter = { ...this.filter, ...filter };
    this.emitProblemsChanged();
  }

  /**
   * Get current filter
   */
  getFilter(): ProblemsFilter {
    return { ...this.filter };
  }

  /**
   * Reset filter to default
   */
  resetFilter(): void {
    this.filter = { ...DEFAULT_FILTER };
    this.emitProblemsChanged();
  }

  // ============================================================================
  // Count Methods
  // ============================================================================

  /**
   * Get problem counts
   */
  getCounts(): ProblemsCount {
    const all = this.getAllDiagnostics();
    return calculateCounts(all);
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    for (const fileDiags of Array.from(this.fileDiagnostics.values())) {
      for (const sourceDiags of fileDiags) {
        if (sourceDiags.diagnostics.some(d => d.severity === DiagnosticSeverity.Error)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get error count for status bar
   */
  getErrorCount(): number {
    let count = 0;
    for (const fileDiags of Array.from(this.fileDiagnostics.values())) {
      for (const sourceDiags of fileDiags) {
        count += sourceDiags.diagnostics.filter(
          d => d.severity === DiagnosticSeverity.Error
        ).length;
      }
    }
    return count;
  }

  /**
   * Get warning count for status bar
   */
  getWarningCount(): number {
    let count = 0;
    for (const fileDiags of Array.from(this.fileDiagnostics.values())) {
      for (const sourceDiags of fileDiags) {
        count += sourceDiags.diagnostics.filter(
          d => d.severity === DiagnosticSeverity.Warning
        ).length;
      }
    }
    return count;
  }

  // ============================================================================
  // Events
  // ============================================================================

  get onProblemsChanged(): EventEmitter<ProblemsChangedEvent> {
    return this.onProblemsChangedEmitter;
  }

  get onFileValidationStarted(): EventEmitter<string> {
    return this.onFileValidationStartedEmitter;
  }

  get onFileValidationFinished(): EventEmitter<string> {
    return this.onFileValidationFinishedEmitter;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private normalizePath(filePath: string): string {
    // Convert to absolute path if relative
    if (!filePath.startsWith('/') && !filePath.includes(':\\')) {
      return `${this.workspaceRoot}/${filePath}`.replace(/\\/g, '/');
    }
    return filePath.replace(/\\/g, '/');
  }

  private detectLanguageId(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescriptreact',
      'js': 'javascript',
      'jsx': 'javascriptreact',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'rb': 'ruby',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
      'json': 'json',
      'md': 'markdown',
      'css': 'css',
      'scss': 'scss',
      'html': 'html',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'sql': 'sql',
      'sh': 'shellscript',
      'bash': 'shellscript',
      'zsh': 'shellscript',
      'dockerfile': 'dockerfile',
    };
    return languageMap[ext || ''] || 'plaintext';
  }

  private convertToProblemItems(filePath: string): ProblemItemData[] {
    const fileDiags = this.fileDiagnostics.get(filePath);
    if (!fileDiags) return [];

    const items: ProblemItemData[] = [];
    let index = 0;

    for (const sourceDiags of fileDiags) {
      for (const diagnostic of sourceDiags.diagnostics) {
        items.push({
          id: generateProblemId(filePath, diagnostic, index++),
          diagnostic,
          file: filePath,
          relativeFile: this.getRelativePath(filePath),
          line: diagnostic.range.start.line + 1, // 1-based for display
          column: diagnostic.range.start.character,
          source: diagnostic.source || sourceDiags.source,
          code: diagnostic.code,
          hasFix: false, // Will be updated by code action providers
        });
      }
    }

    // Sort by severity then by position
    items.sort((a, b) => {
      if (a.diagnostic.severity !== b.diagnostic.severity) {
        return a.diagnostic.severity - b.diagnostic.severity;
      }
      if (a.diagnostic.range.start.line !== b.diagnostic.range.start.line) {
        return a.diagnostic.range.start.line - b.diagnostic.range.start.line;
      }
      return a.diagnostic.range.start.character - b.diagnostic.range.start.character;
    });

    return items;
  }

  private getRelativePath(filePath: string): string {
    if (filePath.startsWith(this.workspaceRoot)) {
      return filePath.slice(this.workspaceRoot.length + 1);
    }
    return filePath;
  }

  private applyFilter(problems: ProblemItemData[]): ProblemItemData[] {
    return problems.filter(p => {
      switch (p.diagnostic.severity) {
        case DiagnosticSeverity.Error:
          return this.filter.errors;
        case DiagnosticSeverity.Warning:
          return this.filter.warnings;
        case DiagnosticSeverity.Information:
          return this.filter.information;
        case DiagnosticSeverity.Hint:
          return this.filter.hints;
        default:
          return true;
      }
    });
  }

  private emitProblemsChanged(filePath?: string): void {
    const all = this.getAllDiagnostics();
    const counts = calculateCounts(all);
    
    this.onProblemsChangedEmitter.emit({
      problems: all,
      counts,
      fileSpecific: filePath,
    });
  }

  private rangeIntersects(a: { start: { line: number; character: number }; end: { line: number; character: number } }, b: { start: { line: number; character: number }; end: { line: number; character: number } }): boolean {
    // Check if ranges intersect
    if (a.end.line < b.start.line) return false;
    if (a.start.line > b.end.line) return false;
    if (a.end.line === b.start.line && a.end.character < b.start.character) return false;
    if (a.start.line === b.end.line && a.start.character > b.end.character) return false;
    return true;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  dispose(): void {
    this.fileDiagnostics.clear();
    this.languageProviders.clear();
    this.onProblemsChangedEmitter.dispose();
    this.onFileValidationStartedEmitter.dispose();
    this.onFileValidationFinishedEmitter.dispose();
  }
}

// Singleton instance
let globalProblemsManager: ProblemsManager | null = null;

export function getProblemsManager(options?: ProblemsManagerOptions): ProblemsManager {
  if (!globalProblemsManager) {
    globalProblemsManager = new ProblemsManager(options);
  }
  return globalProblemsManager;
}

export function setProblemsManager(manager: ProblemsManager): void {
  globalProblemsManager = manager;
}
