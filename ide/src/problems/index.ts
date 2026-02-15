/**
 * Problems Panel Module
 * IDE Kimi IDE - VS Code-like Problems Panel
 * 
 * @example
 * ```typescript
 * // Main process
 * import { setupProblemsIPCHandlers, ProblemsManager } from './problems';
 * 
 * const problemsManager = new ProblemsManager({ workspaceRoot });
 * setupProblemsIPCHandlers(problemsManager);
 * 
 * // Publish diagnostics from a language provider
 * problemsManager.publishDiagnostics(filePath, diagnostics, 'eslint');
 * 
 * // Renderer process
 * import { ProblemsPanel, useProblems } from './problems';
 * 
 * function App() {
 *   return <ProblemsPanel height={200} />;
 * }
 * ```
 */

// ============================================================================
// Core Types & Classes
// ============================================================================

export {
  // Types
  type ProblemItemData,
  type CodeAction,
  type WorkspaceEdit,
  type TextEdit,
  type ProblemsFilter,
  type ProblemsGroupBy,
  type ProblemsCount,
  type GroupedProblems,
  type ProblemsChangedEvent,
  type ProblemsPanelState,
  type ProblemsIPCAPI,
  type LanguageDiagnosticsProvider,
  
  // Constants & Enums
  DEFAULT_FILTER,
  
  // Helper functions
  severityToString,
  severityToLabel,
  severityToColor,
  filterProblemsBySeverity,
  groupProblems,
  calculateCounts,
  generateProblemId,
} from './types';

// ============================================================================
// Manager
// ============================================================================

export {
  ProblemsManager,
  type FileDiagnostics,
  type ProblemsManagerOptions,
  getProblemsManager,
  setProblemsManager,
} from './ProblemsManager';

// ============================================================================
// IPC
// ============================================================================

export {
  PROBLEMS_CHANNELS,
  setupProblemsIPCHandlers,
  removeProblemsIPCHandlers,
} from './ipc';

// ============================================================================
// Renderer IPC API
// ============================================================================

export {
  // Functions
  getAllProblems,
  getProblemsForFile,
  clearAllProblems,
  clearProblemsForFile,
  openFileAtPosition,
  applyCodeAction,
  getCodeActions,
  copyProblemMessage,
  getProblemCounts,
  setProblemsFilter,
  getProblemsFilter,
  
  // Event listeners
  onProblemsChanged,
  onValidationStarted,
  onValidationFinished,
  onOpenFileInEditor,
  
  // Types
  type ProblemsChangedListener,
  type ValidationStartedListener,
  type ValidationFinishedListener,
  type OpenFileInEditorListener,
  
  // API object
  problems,
} from './renderer-ipc';

// ============================================================================
// React Hooks
// ============================================================================

export {
  useProblems,
  type UseProblemsOptions,
  type UseProblemsReturn,
} from './hooks';

// ============================================================================
// React Components
// ============================================================================

export {
  ProblemIcon,
  ProblemItem,
  ProblemsFilterBar,
  ProblemsPanel,
  ProblemsStatusBar,
} from './components';

// ============================================================================
// Language Provider Integrations
// ============================================================================

export {
  // Python
  PythonDiagnosticsProvider,
  createPythonDiagnosticsProvider,
  
  // TypeScript
  TypeScriptDiagnosticsProvider,
  createTypeScriptDiagnosticsProvider,
  
  // Rust
  RustDiagnosticsProvider,
  createRustDiagnosticsProvider,
  
  // Go
  GoDiagnosticsProvider,
  createGoDiagnosticsProvider,
  
  // Functions
  registerAllLanguageProviders,
  createLanguageProvider,
} from './integrations';
