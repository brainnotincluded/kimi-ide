/**
 * Python Diagnostics Provider
 * IDE Kimi IDE - Integration with Python language support
 */

import { LanguageDiagnosticsProvider, CodeAction } from '../types';
import { Diagnostic, DiagnosticSeverity, Range } from '../../languages/core/types';
import { PythonLanguageProvider } from '../../languages/python/PythonProvider';
import { PythonConfig } from '../../languages/python/PythonConfig';

export class PythonDiagnosticsProvider implements LanguageDiagnosticsProvider {
  languageId = 'python';
  name = 'python-linter';

  private provider: PythonLanguageProvider;

  constructor(config?: PythonConfig) {
    this.provider = new PythonLanguageProvider(config || new PythonConfig());
  }

  async getDiagnostics(filePath: string, content?: string): Promise<Diagnostic[]> {
    try {
      const pythonDiagnostics = await this.provider.getDiagnostics(content || '', filePath);

      return pythonDiagnostics.map((d) => ({
        range: {
          start: { line: d.line - 1, character: d.column },
          end: { line: d.line - 1, character: d.column + 1 },
        },
        severity: this.mapSeverity(d.severity),
        message: d.message,
        code: d.code,
        source: d.source || 'python',
      }));
    } catch (error) {
      console.error('[PythonDiagnosticsProvider] Failed to get diagnostics:', error);
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

export function createPythonDiagnosticsProvider(config?: PythonConfig): PythonDiagnosticsProvider {
  return new PythonDiagnosticsProvider(config);
}
