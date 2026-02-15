/**
 * Go Language Configuration
 * 
 * Configuration defaults and utilities for Go language support
 */

import { GoConfiguration, GoLintTool, GoFormatTool, GoToolsManagement } from './types';

/**
 * Default Go configuration
 */
export const defaultGoConfig: GoConfiguration = {
  toolsManagement: 'auto',
  lintTool: 'staticcheck',
  formatTool: 'goimports',
  buildFlags: [],
  testFlags: ['-v'],
  enableGopls: true
};

/**
 * Available lint tools
 */
export const LINT_TOOLS: { value: GoLintTool; label: string; description: string }[] = [
  {
    value: 'staticcheck',
    label: 'staticcheck',
    description: 'Advanced static analysis tool for Go (recommended)'
  },
  {
    value: 'govet',
    label: 'go vet',
    description: 'Standard Go vet tool'
  },
  {
    value: 'golint',
    label: 'golint',
    description: 'Deprecated linter (use staticcheck instead)'
  }
];

/**
 * Available format tools
 */
export const FORMAT_TOOLS: { value: GoFormatTool; label: string; description: string }[] = [
  {
    value: 'goimports',
    label: 'goimports',
    description: 'Formats and auto-imports packages (recommended)'
  },
  {
    value: 'gofmt',
    label: 'gofmt',
    description: 'Standard Go formatter'
  },
  {
    value: 'gofumpt',
    label: 'gofumpt',
    description: 'Stricter version of gofmt'
  }
];

/**
 * Available tools management options
 */
export const TOOLS_MANAGEMENT: { value: GoToolsManagement; label: string; description: string }[] = [
  {
    value: 'auto',
    label: 'Automatic',
    description: 'Automatically install missing tools'
  },
  {
    value: 'manual',
    label: 'Manual',
    description: 'Manual tool installation'
  }
];

/**
 * Recommended Go tools to install
 */
export const RECOMMENDED_TOOLS = [
  'gopls',        // Language server
  'staticcheck',  // Linting
  'goimports',    // Formatting with imports
  'gofumpt',      // Stricter formatter
  'dlv'           // Debugger
];

/**
 * Go keywords for syntax highlighting and completion
 */
export const GO_KEYWORDS = [
  'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else',
  'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface',
  'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type', 'var'
];

/**
 * Go builtin functions
 */
export const GO_BUILTINS = [
  'append', 'cap', 'close', 'complex', 'copy', 'delete', 'imag', 'len',
  'make', 'new', 'panic', 'print', 'println', 'real', 'recover'
];

/**
 * Go primitive types
 */
export const GO_TYPES = [
  'bool', 'byte', 'complex64', 'complex128', 'error', 'float32', 'float64',
  'int', 'int8', 'int16', 'int32', 'int64', 'rune', 'string',
  'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'uintptr'
];

/**
 * File extensions recognized as Go files
 */
export const GO_EXTENSIONS = ['.go', '.mod', '.sum'];

/**
 * Check if a file is a Go file
 */
export function isGoFile(filePath: string): boolean {
  return GO_EXTENSIONS.some(ext => filePath.toLowerCase().endsWith(ext));
}

/**
 * Merge user config with defaults
 */
export function mergeWithDefaults(config: Partial<GoConfiguration>): GoConfiguration {
  return {
    ...defaultGoConfig,
    ...config
  };
}

/**
 * Validate Go configuration
 */
export function validateConfig(config: Partial<GoConfiguration>): string[] {
  const errors: string[] = [];

  if (config.lintTool && !LINT_TOOLS.find(t => t.value === config.lintTool)) {
    errors.push(`Invalid lint tool: ${config.lintTool}`);
  }

  if (config.formatTool && !FORMAT_TOOLS.find(t => t.value === config.formatTool)) {
    errors.push(`Invalid format tool: ${config.formatTool}`);
  }

  if (config.toolsManagement && !TOOLS_MANAGEMENT.find(t => t.value === config.toolsManagement)) {
    errors.push(`Invalid tools management: ${config.toolsManagement}`);
  }

  return errors;
}
