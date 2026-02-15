/**
 * Go Diagnostics Provider
 * IDE Kimi IDE - Integration with Go language support
 */

import { LanguageDiagnosticsProvider } from '../types';
import { Diagnostic, DiagnosticSeverity } from '../../languages/core/types';
import { GoLanguageProvider } from '../../languages/go/provider/GoLanguageProvider';

export class GoDiagnosticsProvider implements LanguageDiagnosticsProvider {
  languageId = 'go';
  name = 'go-diagnostics';

  private provider: GoLanguageProvider;

  constructor(workspaceRoot: string) {
    this.provider = new GoLanguageProvider({});
    this.provider.setProjectRoot(workspaceRoot);
  }

  async getDiagnostics(filePath: string, _content?: string): Promise<Diagnostic[]> {
    try {
      // Run go vet via the provider
      const result = await this.provider.runGo('vet', [filePath]);

      if (result.success) {
        return [];
      }

      // Parse go vet output
      const diagnostics: Diagnostic[] = [];
      const lines = result.stderr.split('\n');

      for (const line of lines) {
        const match = line.match(/^(.+):(\d+):(\d+):\s*(.+)$/);
        if (match) {
          const [, file, lineNum, col, message] = match;
          if (file === filePath) {
            diagnostics.push({
              range: {
                start: { line: parseInt(lineNum) - 1, character: parseInt(col) - 1 },
                end: { line: parseInt(lineNum) - 1, character: parseInt(col) },
              },
              severity: DiagnosticSeverity.Warning,
              message: message.trim(),
              source: 'go vet',
            });
          }
        }
      }

      return diagnostics;
    } catch (error) {
      console.error('[GoDiagnosticsProvider] Failed to get diagnostics:', error);
      return [];
    }
  }

  async getBuildDiagnostics(filePath?: string): Promise<Diagnostic[]> {
    try {
      const buildResult = await this.provider.build(filePath);

      if (buildResult.success) {
        return [];
      }

      // Convert build errors to diagnostics
      return [
        ...buildResult.errors.map((e) => ({
          range: {
            start: { line: e.line - 1, character: e.column - 1 },
            end: { line: e.line - 1, character: e.column },
          },
          severity: DiagnosticSeverity.Error,
          message: e.message,
          source: 'go build',
        })),
        ...buildResult.warnings.map((w) => ({
          range: {
            start: { line: w.line - 1, character: w.column - 1 },
            end: { line: w.line - 1, character: w.column },
          },
          severity: DiagnosticSeverity.Warning,
          message: w.message,
          source: 'go build',
        })),
      ];
    } catch (error) {
      console.error('[GoDiagnosticsProvider] Failed to get build diagnostics:', error);
      return [];
    }
  }
}

export function createGoDiagnosticsProvider(workspaceRoot: string): GoDiagnosticsProvider {
  return new GoDiagnosticsProvider(workspaceRoot);
}
