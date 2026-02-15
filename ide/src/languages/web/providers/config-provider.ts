/**
 * Configuration File Provider (JSON/YAML/TOML)
 * Provides validation, formatting, and completions for config files
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {
  Diagnostic,
  CompletionItem,
  FormattingOptions,
  FormattingResult,
  TextEdit,
  Position,
  JSONSchemaMapping,
} from '../types';
import { WebConfiguration } from '../config/web-config';

// Import YAML and TOML parsers
let YAML: typeof import('yaml') | null = null;
try {
  YAML = require('yaml');
} catch {
  console.warn('YAML parser not available');
}

let TOML: typeof import('@iarna/toml') | null = null;
try {
  TOML = require('@iarna/toml');
} catch {
  console.warn('TOML parser not available');
}

export class ConfigFileProvider {
  private config: WebConfiguration;
  private schemaCache = new Map<string, unknown>();
  private schemaStore: Map<string, unknown> = new Map();

  constructor(config: WebConfiguration) {
    this.config = config;
    this.loadSchemaStore();
  }

  // ============ Schema Management ============

  private async loadSchemaStore(): Promise<void> {
    // Pre-load common schemas
    const commonSchemas = [
      'https://json.schemastore.org/package.json',
      'https://json.schemastore.org/tsconfig.json',
      'https://json.schemastore.org/eslintrc.json',
      'https://json.schemastore.org/prettierrc.json',
    ];

    for (const url of commonSchemas) {
      try {
        const schema = await this.fetchSchema(url);
        this.schemaStore.set(url, schema);
      } catch (error) {
        console.warn(`Failed to load schema: ${url}`);
      }
    }
  }

  private async fetchSchema(url: string): Promise<unknown> {
    // Check cache first
    if (this.schemaCache.has(url)) {
      return this.schemaCache.get(url)!;
    }

    // For local files
    if (url.startsWith('file://')) {
      const filePath = url.slice(7);
      const content = fs.readFileSync(filePath, 'utf-8');
      const schema = JSON.parse(content);
      this.schemaCache.set(url, schema);
      return schema;
    }

    // For HTTP URLs, we would need to fetch
    // For now, return empty schema
    return {};
  }

  private getSchemasForFile(filePath: string): JSONSchemaMapping[] {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.json') {
      return this.config.getJSONSchemas(filePath);
    } else if (['.yaml', '.yml'].includes(ext)) {
      return this.config.getYAMLSchemas(filePath);
    }
    
    return [];
  }

  // ============ Parsing ============

  private parseContent(filePath: string, content: string): unknown {
    const ext = path.extname(filePath).toLowerCase();

    try {
      switch (ext) {
        case '.json':
          return JSON.parse(content);
        case '.yaml':
        case '.yml':
          if (YAML) {
            return YAML.parse(content);
          }
          throw new Error('YAML parser not available');
        case '.toml':
          if (TOML) {
            return TOML.parse(content);
          }
          throw new Error('TOML parser not available');
        default:
          return null;
      }
    } catch (error) {
      throw error;
    }
  }

  // ============ Validation ============

  public async validate(filePath: string, content: string): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const ext = path.extname(filePath).toLowerCase();

    // Parse validation
    try {
      this.parseContent(filePath, content);
    } catch (error) {
      if (error instanceof Error) {
        const parseError = this.parseErrorMessage(error.message, content, ext);
        diagnostics.push({
          file: filePath,
          line: parseError.line,
          column: parseError.column,
          severity: 'error',
          message: error.message,
          code: 'parse-error',
          source: ext === '.json' ? 'json-schema' : ext === '.toml' ? 'toml' : 'yaml-schema',
        });
      }
      return diagnostics;
    }

    // Schema validation for JSON/YAML
    if (['.json', '.yaml', '.yml'].includes(ext)) {
      const schemaDiagnostics = await this.validateWithSchema(filePath, content);
      diagnostics.push(...schemaDiagnostics);
    }

    return diagnostics;
  }

  private parseErrorMessage(message: string, content: string, ext: string): { line: number; column: number } {
    // Try to extract line and column from error message
    const lineMatch = message.match(/line\s+(\d+)/i);
    const colMatch = message.match(/column\s+(\d+)/i) || message.match(/position\s+(\d+)/i);

    if (lineMatch) {
      return {
        line: parseInt(lineMatch[1], 10),
        column: colMatch ? parseInt(colMatch[1], 10) : 1,
      };
    }

    // JSON parse errors often have position
    if (ext === '.json') {
      const posMatch = message.match(/position\s+(\d+)/i) || message.match(/at\s+position\s+(\d+)/i);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        let line = 1;
        let col = 1;
        for (let i = 0; i < pos && i < content.length; i++) {
          if (content[i] === '\n') {
            line++;
            col = 1;
          } else {
            col++;
          }
        }
        return { line, column: col };
      }
    }

    return { line: 1, column: 1 };
  }

  private async validateWithSchema(filePath: string, content: string): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const schemas = this.getSchemasForFile(filePath);

    if (schemas.length === 0) return diagnostics;

    for (const schemaMapping of schemas) {
      try {
        const schema = await this.fetchSchema(schemaMapping.url);
        if (!schema) continue;

        const schemaDiagnostics = this.validateAgainstSchema(content, schema, filePath);
        diagnostics.push(...schemaDiagnostics);
      } catch (error) {
        console.warn(`Schema validation failed for ${schemaMapping.url}:`, error);
      }
    }

    return diagnostics;
  }

  private validateAgainstSchema(content: string, schema: unknown, filePath: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    
    try {
      const data = JSON.parse(content);
      this.validateValue(data, schema as Record<string, unknown>, [], diagnostics, filePath);
    } catch {
      // Already handled by parse validation
    }

    return diagnostics;
  }

  private validateValue(
    value: unknown,
    schema: Record<string, unknown>,
    path: string[],
    diagnostics: Diagnostic[],
    filePath: string
  ): void {
    // Basic JSON Schema validation
    if (schema.type) {
      const valueType = this.getValueType(value);
      if (schema.type !== valueType && !(
        Array.isArray(schema.type) && (schema.type as string[]).includes(valueType)
      )) {
        diagnostics.push({
          file: filePath,
          line: 1, // Would need source mapping
          column: 1,
          severity: 'error',
          message: `Expected type ${String(schema.type)}, got ${valueType}`,
          code: 'type-error',
          source: 'json-schema',
        });
      }
    }

    // Object validation
    if (schema.type === 'object' && typeof value === 'object' && value !== null) {
      // Check required properties
      if (Array.isArray(schema.required)) {
        for (const required of schema.required) {
          if (!(required as string in value)) {
            diagnostics.push({
              file: filePath,
              line: 1,
              column: 1,
              severity: 'error',
              message: `Missing required property: ${String(required)}`,
              code: 'required-property',
              source: 'json-schema',
            });
          }
        }
      }

      // Validate properties
      if (schema.properties && typeof schema.properties === 'object') {
        for (const [key, val] of Object.entries(value)) {
          const propSchema = (schema.properties as Record<string, unknown>)[key];
          if (propSchema) {
            this.validateValue(val, propSchema as Record<string, unknown>, [...path, key], diagnostics, filePath);
          }
        }
      }
    }

    // Array validation
    if (schema.type === 'array' && Array.isArray(value)) {
      if (schema.items && typeof schema.items === 'object') {
        for (let i = 0; i < value.length; i++) {
          this.validateValue(value[i], schema.items as Record<string, unknown>, [...path, String(i)], diagnostics, filePath);
        }
      }

      if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
        diagnostics.push({
          file: filePath,
          line: 1,
          column: 1,
          severity: 'error',
          message: `Array must have at least ${schema.minItems} items`,
          code: 'min-items',
          source: 'json-schema',
        });
      }

      if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
        diagnostics.push({
          file: filePath,
          line: 1,
          column: 1,
          severity: 'error',
          message: `Array must have at most ${schema.maxItems} items`,
          code: 'max-items',
          source: 'json-schema',
        });
      }
    }

    // Enum validation
    if (Array.isArray(schema.enum)) {
      if (!schema.enum.includes(value)) {
        diagnostics.push({
          file: filePath,
          line: 1,
          column: 1,
          severity: 'error',
          message: `Value must be one of: ${schema.enum.map(String).join(', ')}`,
          code: 'enum-error',
          source: 'json-schema',
        });
      }
    }

    // Pattern validation for strings
    if (schema.type === 'string' && typeof value === 'string' && schema.pattern) {
      const pattern = new RegExp(String(schema.pattern));
      if (!pattern.test(value)) {
        diagnostics.push({
          file: filePath,
          line: 1,
          column: 1,
          severity: 'error',
          message: `String does not match pattern: ${String(schema.pattern)}`,
          code: 'pattern-error',
          source: 'json-schema',
        });
      }
    }
  }

  private getValueType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  // ============ Formatting ============

  public async formatCode(
    filePath: string,
    content: string,
    options?: Partial<FormattingOptions>
  ): Promise<FormattingResult> {
    const ext = path.extname(filePath).toLowerCase();
    const formatOptions = {
      tabSize: options?.tabSize ?? 2,
      insertSpaces: options?.insertSpaces ?? true,
    };

    try {
      let formatted: string;

      switch (ext) {
        case '.json':
          formatted = this.formatJSON(content, formatOptions);
          break;
        case '.yaml':
        case '.yml':
          formatted = this.formatYAML(content, formatOptions);
          break;
        case '.toml':
          formatted = this.formatTOML(content, formatOptions);
          break;
        default:
          formatted = content;
      }

      const edits = this.computeEdits(content, formatted);
      return { formatted, edits };
    } catch (error) {
      console.error('Format error:', error);
      return { formatted: content, edits: [] };
    }
  }

  private formatJSON(content: string, options: { tabSize: number; insertSpaces: boolean }): string {
    const parsed = JSON.parse(content);
    const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
    return JSON.stringify(parsed, null, indent) + '\n';
  }

  private formatYAML(content: string, options: { tabSize: number; insertSpaces: boolean }): string {
    if (!YAML) {
      return content;
    }

    const parsed = YAML.parse(content);
    return YAML.stringify(parsed, {
      indent: options.tabSize,
      indentSeq: true,
    });
  }

  private formatTOML(content: string, options: { tabSize: number; insertSpaces: boolean }): string {
    // TOML doesn't have a standard formatter
    // Return as-is or use a simple indentation fix
    const lines = content.split('\n');
    const formatted: string[] = [];
    let inMultiLineString = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Handle multi-line strings
      if (trimmed.includes('"""') || trimmed.includes("'''")) {
        const quotes = (trimmed.match(/"""/g) || []).length + (trimmed.match(/'''/g) || []).length;
        if (quotes % 2 === 1) {
          inMultiLineString = !inMultiLineString;
        }
      }

      if (!inMultiLineString && trimmed && !trimmed.startsWith('[') && !trimmed.startsWith('#')) {
        // Ensure consistent spacing around =
        const formattedLine = line.replace(/\s*=\s*/, ' = ');
        formatted.push(formattedLine);
      } else {
        formatted.push(line);
      }
    }

    return formatted.join('\n');
  }

  private computeEdits(original: string, formatted: string): TextEdit[] {
    if (original === formatted) return [];

    const lines = original.split('\n');
    const lastLine = lines.length;
    const lastChar = lines[lines.length - 1]?.length || 0;

    return [{
      range: {
        start: { line: 1, character: 0 },
        end: { line: lastLine, character: lastChar },
      },
      newText: formatted,
    }];
  }

  // ============ Completions ============

  public async getCompletions(
    filePath: string,
    position: Position,
    content: string
  ): Promise<CompletionItem[]> {
    const ext = path.extname(filePath).toLowerCase();
    const schemas = this.getSchemasForFile(filePath);

    if (schemas.length === 0) {
      return this.getDefaultCompletions(ext, content, position);
    }

    const completions: CompletionItem[] = [];

    for (const schemaMapping of schemas) {
      try {
        const schema = await this.fetchSchema(schemaMapping.url);
        if (!schema) continue;

        const schemaCompletions = this.getSchemaCompletions(schema as Record<string, unknown>, content, position);
        completions.push(...schemaCompletions);
      } catch (error) {
        console.warn(`Failed to get completions from schema ${schemaMapping.url}:`, error);
      }
    }

    return completions;
  }

  private getDefaultCompletions(
    ext: string,
    content: string,
    position: Position
  ): CompletionItem[] {
    const completions: CompletionItem[] = [];

    if (ext === '.json') {
      // Common JSON keys
      if (path.basename(content).includes('package')) {
        completions.push(
          { label: 'name', kind: 'property', detail: 'Package name' },
          { label: 'version', kind: 'property', detail: 'Package version' },
          { label: 'description', kind: 'property', detail: 'Package description' },
          { label: 'main', kind: 'property', detail: 'Entry point' },
          { label: 'scripts', kind: 'property', detail: 'NPM scripts' },
          { label: 'dependencies', kind: 'property', detail: 'Dependencies' },
          { label: 'devDependencies', kind: 'property', detail: 'Dev dependencies' },
        );
      }
    }

    return completions;
  }

  private getSchemaCompletions(
    schema: Record<string, unknown>,
    content: string,
    position: Position
  ): CompletionItem[] {
    const completions: CompletionItem[] = [];

    // Get current path in document
    const currentPath = this.getCurrentPath(content, position);

    // Navigate to current schema position
    let currentSchema: unknown = schema;
    for (const key of currentPath) {
      if (currentSchema && typeof currentSchema === 'object') {
        const props = (currentSchema as Record<string, unknown>).properties;
        if (props && typeof props === 'object') {
          currentSchema = (props as Record<string, unknown>)[key];
        } else {
          const items = (currentSchema as Record<string, unknown>).items;
          if (items && typeof items === 'object') {
            currentSchema = items;
          }
        }
      }
    }

    // Suggest properties
    if (currentSchema && typeof currentSchema === 'object') {
      const props = (currentSchema as Record<string, unknown>).properties;
      if (props && typeof props === 'object') {
        for (const [key, propSchema] of Object.entries(props)) {
          const prop = propSchema as Record<string, unknown>;
          completions.push({
            label: key,
            kind: 'property',
            detail: String(prop.type || 'unknown'),
            documentation: String(prop.description || ''),
            insertText: `"${key}": `,
          });
        }
      }

      // Suggest enum values
      const enumValues = (currentSchema as Record<string, unknown>).enum;
      if (Array.isArray(enumValues)) {
        for (const value of enumValues) {
          completions.push({
            label: String(value),
            kind: 'value',
            insertText: JSON.stringify(value),
          });
        }
      }
    }

    return completions;
  }

  private getCurrentPath(content: string, position: Position): string[] {
    // Simple path detection based on document structure
    const lines = content.split('\n');
    const path: string[] = [];
    let currentIndent = 0;

    for (let i = 0; i < position.line - 1 && i < lines.length; i++) {
      const line = lines[i];
      const indent = line.match(/^(\s*)/)?.[0].length || 0;
      const trimmed = line.trim();

      if (indent <= currentIndent) {
        // Pop to matching level
        while (path.length > 0 && indent <= currentIndent) {
          path.pop();
          currentIndent -= 2;
        }
      }

      const keyMatch = trimmed.match(/^"?([\w-]+)"?\s*:/);
      if (keyMatch) {
        path.push(keyMatch[1]);
        currentIndent = indent;
      }
    }

    return path;
  }

  // ============ Utility ============

  public isConfigFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.json', '.yaml', '.yml', '.toml'].includes(ext);
  }

  public getFileType(filePath: string): 'json' | 'yaml' | 'toml' | null {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.json':
        return 'json';
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.toml':
        return 'toml';
      default:
        return null;
    }
  }
}
