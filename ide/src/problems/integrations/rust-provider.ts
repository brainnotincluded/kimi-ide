/**
 * Rust Diagnostics Provider
 * IDE Kimi IDE - Integration with Rust language support
 */

import { LanguageDiagnosticsProvider, CodeAction } from '../types';
import { Diagnostic, DiagnosticSeverity } from '../../languages/core/types';
import { RustLanguageProvider } from '../../languages/rust/provider';

export class RustDiagnosticsProvider implements LanguageDiagnosticsProvider {
  languageId = 'rust';
  name = 'rust-diagnostics';

  private provider: RustLanguageProvider;

  constructor(workspaceRoot: string) {
    this.provider = new RustLanguageProvider(workspaceRoot);
  }

  async getDiagnostics(filePath: string, _content?: string): Promise<Diagnostic[]> {
    try {
      // Get diagnostics from cargo check
      const diagnostics = await this.provider.getDiagnostics();

      // Filter diagnostics for the specific file
      const fileDiagnostics = diagnostics.filter((d) => d.file === filePath);

      return fileDiagnostics.map((d) => ({
        range: {
          start: { line: d.line - 1, character: d.column },
          end: { line: d.line - 1, character: d.column + 1 }, // Rust doesn't have end position in this type
        },
        severity: this.mapSeverity(d.severity),
        message: d.message,
        code: d.code,
        source: 'rustc',
      }));
    } catch (error) {
      console.error('[RustDiagnosticsProvider] Failed to get diagnostics:', error);
      return [];
    }
  }

  async getClippyDiagnostics(filePath?: string): Promise<Diagnostic[]> {
    try {
      const diagnostics = await this.provider.getClippyDiagnostics();

      // Filter diagnostics for the specific file
      const fileDiagnostics = filePath
        ? diagnostics.filter((d) => d.file === filePath)
        : diagnostics;

      return fileDiagnostics.map((d) => ({
        range: {
          start: { line: d.line - 1, character: d.column },
          end: { line: d.line - 1, character: d.column + 1 },
        },
        severity: this.mapSeverity(d.severity),
        message: d.message,
        code: d.code,
        source: 'clippy',
      }));
    } catch (error) {
      console.error('[RustDiagnosticsProvider] Failed to get clippy diagnostics:', error);
      return [];
    }
  }

  private mapSeverity(severity: 'error' | 'warning' | 'info' | 'hint'): DiagnosticSeverity {
    switch (severity) {
      case 'error':
        return DiagnosticSeverity.Error;
      case 'warning':
        return DiagnosticSeverity.Warning;
      case 'info':
        return DiagnosticSeverity.Information;
      case 'hint':
        return DiagnosticSeverity.Hint;
      default:
        return DiagnosticSeverity.Error;
    }
  }
}

export function createRustDiagnosticsProvider(workspaceRoot: string): RustDiagnosticsProvider {
  return new RustDiagnosticsProvider(workspaceRoot);
}
