/**
 * Problems Panel Language Provider Integrations
 * IDE Kimi IDE - Factory for language-specific diagnostics providers
 */

import { LanguageDiagnosticsProvider } from '../types';
import { ProblemsManager } from '../ProblemsManager';
import { PythonDiagnosticsProvider, createPythonDiagnosticsProvider } from './python-provider';
import { TypeScriptDiagnosticsProvider, createTypeScriptDiagnosticsProvider } from './typescript-provider';
import { RustDiagnosticsProvider, createRustDiagnosticsProvider } from './rust-provider';
import { GoDiagnosticsProvider, createGoDiagnosticsProvider } from './go-provider';

export {
  PythonDiagnosticsProvider,
  createPythonDiagnosticsProvider,
  TypeScriptDiagnosticsProvider,
  createTypeScriptDiagnosticsProvider,
  RustDiagnosticsProvider,
  createRustDiagnosticsProvider,
  GoDiagnosticsProvider,
  createGoDiagnosticsProvider,
};

/**
 * Register all language providers with the problems manager
 */
export function registerAllLanguageProviders(
  problemsManager: ProblemsManager,
  workspaceRoot: string
): void {
  // Python
  try {
    const pythonProvider = createPythonDiagnosticsProvider();
    problemsManager.registerLanguageProvider(pythonProvider);
  } catch (error) {
    console.warn('[ProblemsIntegrations] Failed to register Python provider:', error);
  }

  // TypeScript / JavaScript
  try {
    const tsProvider = createTypeScriptDiagnosticsProvider(workspaceRoot);
    problemsManager.registerLanguageProvider(tsProvider);
  } catch (error) {
    console.warn('[ProblemsIntegrations] Failed to register TypeScript provider:', error);
  }

  // Rust
  try {
    const rustProvider = createRustDiagnosticsProvider(workspaceRoot);
    problemsManager.registerLanguageProvider(rustProvider);
  } catch (error) {
    console.warn('[ProblemsIntegrations] Failed to register Rust provider:', error);
  }

  // Go
  try {
    const goProvider = createGoDiagnosticsProvider(workspaceRoot);
    problemsManager.registerLanguageProvider(goProvider);
  } catch (error) {
    console.warn('[ProblemsIntegrations] Failed to register Go provider:', error);
  }
}

/**
 * Create a language provider for a specific language
 */
export function createLanguageProvider(
  languageId: string,
  workspaceRoot: string
): LanguageDiagnosticsProvider | null {
  switch (languageId) {
    case 'python':
      return createPythonDiagnosticsProvider();
    case 'typescript':
    case 'javascript':
      return createTypeScriptDiagnosticsProvider(workspaceRoot);
    case 'rust':
      return createRustDiagnosticsProvider(workspaceRoot);
    case 'go':
      return createGoDiagnosticsProvider(workspaceRoot);
    default:
      return null;
  }
}
