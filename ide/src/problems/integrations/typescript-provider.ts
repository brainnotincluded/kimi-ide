/**
 * TypeScript Diagnostics Provider
 * IDE Kimi IDE - Integration with TypeScript language support
 */

import { LanguageDiagnosticsProvider, CodeAction } from '../types';
import { Diagnostic, DiagnosticSeverity, Range } from '../../languages/core/types';
import { TypeScriptProvider } from '../../languages/web/providers/typescript-provider';
import { WebConfiguration } from '../../languages/web/config/web-config';

export class TypeScriptDiagnosticsProvider implements LanguageDiagnosticsProvider {
  languageId = 'typescript';
  name = 'typescript-diagnostics';

  private provider: TypeScriptProvider;

  constructor(workspaceRoot: string) {
    const config = new WebConfiguration(workspaceRoot);
    this.provider = new TypeScriptProvider(config);
    this.provider.initialize().catch(console.error);
  }

  async getDiagnostics(filePath: string, content?: string): Promise<Diagnostic[]> {
    try {
      const diagnostics = await this.provider.getDiagnostics(filePath, content);

      return diagnostics.map((d) => ({
        range: {
          start: { line: d.line - 1, character: d.column - 1 },
          end: { line: (d as any).endLine || d.line - 1, character: (d as any).endColumn || d.column },
        },
        severity: this.mapSeverity(d.severity),
        message: d.message,
        code: d.code,
        source: d.source || 'typescript',
      }));
    } catch (error) {
      console.error('[TypeScriptDiagnosticsProvider] Failed to get diagnostics:', error);
      return [];
    }
  }

  async getCodeActions(
    filePath: string,
    range: Range,
    diagnostics: Diagnostic[]
  ): Promise<CodeAction[]> {
    try {
      const refactorings = await this.provider.getRefactorings(filePath, range);

      return refactorings.map((r) => ({
        title: r.description,
        kind: r.kind as 'quickfix' | 'refactor' | 'source',
        edit: r.edits,
      }));
    } catch (error) {
      console.error('[TypeScriptDiagnosticsProvider] Failed to get code actions:', error);
      return [];
    }
  }

  private mapSeverity(severity: string): DiagnosticSeverity {
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

  dispose(): void {
    this.provider.dispose();
  }
}

export function createTypeScriptDiagnosticsProvider(workspaceRoot: string): TypeScriptDiagnosticsProvider {
  return new TypeScriptDiagnosticsProvider(workspaceRoot);
}
