/**
 * Rust Language Support Types
 * Type definitions for Rust toolchain and cargo operations
 */

export interface RustToolchainInfo {
  version: string;
  target: string;
  host: string;
  toolchain: 'stable' | 'nightly' | 'beta' | string;
  commitHash?: string;
  commitDate?: string;
}

export interface RustInstallationCheck {
  installed: boolean;
  rustup?: boolean;
  cargo?: boolean;
  rustc?: boolean;
  rustfmt?: boolean;
  rustAnalyzer?: boolean;
  errors?: string[];
}

export type CargoCommand = 'build' | 'test' | 'run' | 'check' | 'clean' | 'doc' | 'clippy' | 'fmt' | 'update';

export interface CargoOptions {
  release?: boolean;
  target?: string;
  features?: string[];
  allFeatures?: boolean;
  noDefaultFeatures?: boolean;
  verbose?: boolean;
  package?: string;
  args?: string[];
}

export interface CargoResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration?: number;
}

export interface RustDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  code?: string;
  suggestion?: string;
}

export interface RustCompletionItem {
  label: string;
  kind: CompletionItemKind;
  detail?: string;
  documentation?: string;
  insertText?: string;
}

export type CompletionItemKind =
  | 'text'
  | 'method'
  | 'function'
  | 'constructor'
  | 'field'
  | 'variable'
  | 'class'
  | 'interface'
  | 'module'
  | 'property'
  | 'unit'
  | 'value'
  | 'enum'
  | 'keyword'
  | 'snippet'
  | 'color'
  | 'file'
  | 'reference'
  | 'folder'
  | 'enumMember'
  | 'constant'
  | 'struct'
  | 'event'
  | 'operator'
  | 'typeParameter';

export interface CargoToml {
  package?: {
    name: string;
    version: string;
    edition?: string;
    authors?: string[];
    description?: string;
    license?: string;
    repository?: string;
  };
  dependencies?: Record<string, CargoDependency>;
  'dev-dependencies'?: Record<string, CargoDependency>;
  features?: Record<string, string[]>;
  workspace?: {
    members?: string[];
  };
  bin?: Array<{ name: string; path: string }>;
  lib?: { name: string; path: string };
}

export type CargoDependency =
  | string
  | {
      version?: string;
      path?: string;
      git?: string;
      branch?: string;
      tag?: string;
      rev?: string;
      features?: string[];
      optional?: boolean;
      default_features?: boolean;
    };

export interface DependencyNode {
  name: string;
  version: string;
  path?: string;
  features: string[];
  children: DependencyNode[];
}

export interface RustConfiguration {
  toolchain: 'stable' | 'nightly' | 'beta';
  target: string;
  features: string[];
  cargoArgs: string[];
  rustfmtOnSave: boolean;
  checkOnSave: boolean;
  clippyOnSave: boolean;
}

export const DEFAULT_RUST_CONFIG: RustConfiguration = {
  toolchain: 'stable',
  target: '',
  features: [],
  cargoArgs: [],
  rustfmtOnSave: true,
  checkOnSave: true,
  clippyOnSave: false,
};
