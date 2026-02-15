/**
 * Problems Panel Types
 * IDE Kimi IDE - VS Code-like Problems Panel
 */

import { Diagnostic, DiagnosticSeverity, Range, Position } from '../languages/core/types';

// Re-export Position for convenience
export { Position } from '../languages/core/types';

// ============================================================================
// Problem Item Types
// ============================================================================

export interface ProblemItemData {
  /** Unique ID for the problem */
  id: string;
  /** Diagnostic information */
  diagnostic: Diagnostic;
  /** File path */
  file: string;
  /** Relative file path from workspace root */
  relativeFile: string;
  /** Line number (1-based for display) */
  line: number;
  /** Column number (0-based) */
  column: number;
  /** Source of the diagnostic (linter/tool name) */
  source: string;
  /** Error/warning code */
  code?: string | number;
  /** Whether this problem has a quick fix available */
  hasFix?: boolean;
  /** Code actions for this problem */
  codeActions?: CodeAction[];
}

export interface CodeAction {
  /** Action title */
  title: string;
  /** Action kind */
  kind: 'quickfix' | 'refactor' | 'source';
  /** Whether this is a preferred action */
  isPreferred?: boolean;
  /** Text edits to apply */
  edit?: WorkspaceEdit;
  /** Command to execute */
  command?: {
    title: string;
    command: string;
    arguments?: any[];
  };
}

export interface WorkspaceEdit {
  changes: Record<string, TextEdit[]>;
}

export interface TextEdit {
  range: Range;
  newText: string;
}

// ============================================================================
// Filter Types
// ============================================================================

export type ProblemSeverityFilter = 'error' | 'warning' | 'information' | 'hint';

export interface ProblemsFilter {
  /** Show errors */
  errors: boolean;
  /** Show warnings */
  warnings: boolean;
  /** Show information */
  information: boolean;
  /** Show hints */
  hints: boolean;
  /** Filter by source */
  source?: string;
  /** Filter by search text */
  searchText?: string;
}

export const DEFAULT_FILTER: ProblemsFilter = {
  errors: true,
  warnings: true,
  information: true,
  hints: true,
};

// ============================================================================
// Grouping Types
// ============================================================================

export type ProblemsGroupBy = 'file' | 'severity' | 'source' | 'none';

export interface GroupedProblems {
  /** Group name */
  name: string;
  /** Group key */
  key: string;
  /** Problems in this group */
  problems: ProblemItemData[];
  /** Whether the group is expanded */
  expanded: boolean;
  /** Severity if grouped by severity */
  severity?: DiagnosticSeverity;
  /** File path if grouped by file */
  file?: string;
}

// ============================================================================
// Events
// ============================================================================

export interface ProblemsChangedEvent {
  /** All current problems */
  problems: ProblemItemData[];
  /** Count by severity */
  counts: ProblemsCount;
  /** Whether the change was for a specific file */
  fileSpecific?: string;
}

export interface ProblemsCount {
  errors: number;
  warnings: number;
  information: number;
  hints: number;
  total: number;
}

// ============================================================================
// Panel State
// ============================================================================

export interface ProblemsPanelState {
  /** Current filter settings */
  filter: ProblemsFilter;
  /** Group by setting */
  groupBy: ProblemsGroupBy;
  /** Expanded file groups */
  expandedGroups: Set<string>;
  /** Selected problem ID */
  selectedProblemId?: string;
  /** Panel visibility */
  isVisible: boolean;
  /** Panel height */
  height: number;
}

// ============================================================================
// IPC Types
// ============================================================================

export interface ProblemsIPCAPI {
  /** Get all problems */
  getAll: () => Promise<ProblemItemData[]>;
  /** Get problems for a specific file */
  getForFile: (filePath: string) => Promise<ProblemItemData[]>;
  /** Clear all problems */
  clearAll: () => Promise<void>;
  /** Clear problems for a file */
  clearForFile: (filePath: string) => Promise<void>;
  /** Open file at specific position */
  openFile: (filePath: string, position: Position) => Promise<void>;
  /** Apply code action */
  applyCodeAction: (filePath: string, action: CodeAction) => Promise<boolean>;
  /** Get code actions for a problem */
  getCodeActions: (filePath: string, range: Range) => Promise<CodeAction[]>;
  /** Copy problem message to clipboard */
  copyMessage: (message: string) => Promise<void>;
}

// ============================================================================
// Language Provider Integration
// ============================================================================

export interface LanguageDiagnosticsProvider {
  /** Language ID */
  languageId: string;
  /** Provider name */
  name: string;
  /** Get diagnostics for a file */
  getDiagnostics(filePath: string, content?: string): Promise<Diagnostic[]>;
  /** Get code actions */
  getCodeActions?(filePath: string, range: Range, diagnostics: Diagnostic[]): Promise<CodeAction[]>;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function severityToString(severity: DiagnosticSeverity): string {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return 'error';
    case DiagnosticSeverity.Warning:
      return 'warning';
    case DiagnosticSeverity.Information:
      return 'information';
    case DiagnosticSeverity.Hint:
      return 'hint';
    default:
      return 'error';
  }
}

export function severityToLabel(severity: DiagnosticSeverity): string {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return 'Error';
    case DiagnosticSeverity.Warning:
      return 'Warning';
    case DiagnosticSeverity.Information:
      return 'Info';
    case DiagnosticSeverity.Hint:
      return 'Hint';
    default:
      return 'Error';
  }
}

export function severityToColor(severity: DiagnosticSeverity): string {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return '#f44336'; // Red
    case DiagnosticSeverity.Warning:
      return '#ff9800'; // Orange
    case DiagnosticSeverity.Information:
      return '#2196f3'; // Blue
    case DiagnosticSeverity.Hint:
      return '#4caf50'; // Green
    default:
      return '#f44336';
  }
}

export function filterProblemsBySeverity(
  problems: ProblemItemData[],
  filter: ProblemsFilter
): ProblemItemData[] {
  return problems.filter(p => {
    switch (p.diagnostic.severity) {
      case DiagnosticSeverity.Error:
        return filter.errors;
      case DiagnosticSeverity.Warning:
        return filter.warnings;
      case DiagnosticSeverity.Information:
        return filter.information;
      case DiagnosticSeverity.Hint:
        return filter.hints;
      default:
        return true;
    }
  });
}

export function groupProblems(
  problems: ProblemItemData[],
  groupBy: ProblemsGroupBy
): GroupedProblems[] {
  const groups = new Map<string, GroupedProblems>();

  for (const problem of problems) {
    let key: string;
    let name: string;
    let severity: DiagnosticSeverity | undefined;
    let file: string | undefined;

    switch (groupBy) {
      case 'file':
        key = problem.file;
        name = problem.relativeFile;
        file = problem.file;
        break;
      case 'severity':
        key = severityToString(problem.diagnostic.severity);
        name = severityToLabel(problem.diagnostic.severity) + 's';
        severity = problem.diagnostic.severity;
        break;
      case 'source':
        key = problem.source || 'unknown';
        name = problem.source || 'Unknown';
        break;
      case 'none':
      default:
        key = 'all';
        name = 'All Problems';
        break;
    }

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name,
        problems: [],
        expanded: true,
        severity,
        file,
      });
    }

    groups.get(key)!.problems.push(problem);
  }

  // Sort groups
  const sortedGroups = Array.from(groups.values());
  
  if (groupBy === 'severity') {
    const severityOrder = [
      DiagnosticSeverity.Error,
      DiagnosticSeverity.Warning,
      DiagnosticSeverity.Information,
      DiagnosticSeverity.Hint,
    ];
    sortedGroups.sort((a, b) => {
      const aOrder = severityOrder.indexOf(a.severity!);
      const bOrder = severityOrder.indexOf(b.severity!);
      return aOrder - bOrder;
    });
  } else if (groupBy === 'file') {
    sortedGroups.sort((a, b) => a.name.localeCompare(b.name));
  }

  return sortedGroups;
}

export function calculateCounts(problems: ProblemItemData[]): ProblemsCount {
  return {
    errors: problems.filter(p => p.diagnostic.severity === DiagnosticSeverity.Error).length,
    warnings: problems.filter(p => p.diagnostic.severity === DiagnosticSeverity.Warning).length,
    information: problems.filter(p => p.diagnostic.severity === DiagnosticSeverity.Information).length,
    hints: problems.filter(p => p.diagnostic.severity === DiagnosticSeverity.Hint).length,
    total: problems.length,
  };
}

export function generateProblemId(file: string, diagnostic: Diagnostic, index: number): string {
  const pos = `${diagnostic.range.start.line}:${diagnostic.range.start.character}`;
  const code = diagnostic.code || 'no-code';
  return `${file}:${pos}:${code}:${index}`;
}
