/**
 * Rust Language Support Renderer API
 * Client-side API for Rust integration in the renderer process
 */

import { ipcRenderer } from 'electron';
import {
  RustToolchainInfo,
  RustInstallationCheck,
  CargoCommand,
  CargoOptions,
  CargoResult,
  RustDiagnostic,
  RustCompletionItem,
  CargoToml,
  RustConfiguration,
} from './types';

/**
 * Check Rust installation
 */
export async function checkRustInstallation(): Promise<RustInstallationCheck> {
  return ipcRenderer.invoke('rust:checkInstallation');
}

/**
 * Get Rust toolchain information
 */
export async function getToolchainInfo(): Promise<RustToolchainInfo | null> {
  return ipcRenderer.invoke('rust:getToolchainInfo');
}

/**
 * Run a cargo command
 */
export async function runCargo(
  workspaceRoot: string,
  command: CargoCommand,
  options?: CargoOptions
): Promise<CargoResult> {
  return ipcRenderer.invoke('rust:runCargo', workspaceRoot, command, options);
}

/**
 * Run cargo check and get diagnostics
 */
export async function checkCode(workspaceRoot: string): Promise<RustDiagnostic[]> {
  return ipcRenderer.invoke('rust:check', workspaceRoot);
}

/**
 * Run clippy and get diagnostics
 */
export async function runClippy(workspaceRoot: string): Promise<RustDiagnostic[]> {
  return ipcRenderer.invoke('rust:clippy', workspaceRoot);
}

/**
 * Format code in file
 */
export async function formatCode(filePath: string): Promise<{
  success: boolean;
  content?: string;
  error?: string;
}> {
  return ipcRenderer.invoke('rust:format', filePath);
}

/**
 * Format code string
 */
export async function formatCodeString(code: string): Promise<{
  success: boolean;
  content?: string;
  error?: string;
}> {
  return ipcRenderer.invoke('rust:formatString', code);
}

/**
 * Get code completions
 */
export async function getCompletions(
  filePath: string,
  line: number,
  column: number
): Promise<RustCompletionItem[]> {
  return ipcRenderer.invoke('rust:getCompletions', filePath, line, column);
}

/**
 * Get project information
 */
export async function getProjectInfo(workspaceRoot: string): Promise<{
  isRustProject: boolean;
  projectName: string | null;
  cargoToml: CargoToml | null;
  dependencies: Array<{ name: string; version: string; isDev: boolean }>;
  availableFeatures: string[];
}> {
  return ipcRenderer.invoke('rust:getProjectInfo', workspaceRoot);
}

/**
 * Get dependencies
 */
export async function getDependencies(
  workspaceRoot: string
): Promise<Array<{ name: string; version: string; isDev: boolean }>> {
  return ipcRenderer.invoke('rust:getDependencies', workspaceRoot);
}

/**
 * Update dependencies
 */
export async function updateDependencies(workspaceRoot: string): Promise<CargoResult> {
  return ipcRenderer.invoke('rust:updateDependencies', workspaceRoot);
}

/**
 * Update configuration
 */
export async function updateConfig(
  workspaceRoot: string,
  config: Partial<RustConfiguration>
): Promise<RustConfiguration> {
  return ipcRenderer.invoke('rust:updateConfig', workspaceRoot, config);
}

/**
 * Get configuration
 */
export async function getConfig(workspaceRoot: string): Promise<RustConfiguration> {
  return ipcRenderer.invoke('rust:getConfig', workspaceRoot);
}

/**
 * Build project
 */
export async function build(workspaceRoot: string, release?: boolean): Promise<CargoResult> {
  return ipcRenderer.invoke('rust:build', workspaceRoot, release);
}

/**
 * Test project
 */
export async function test(workspaceRoot: string, options?: CargoOptions): Promise<CargoResult> {
  return ipcRenderer.invoke('rust:test', workspaceRoot, options);
}

/**
 * Run project
 */
export async function run(workspaceRoot: string, options?: CargoOptions): Promise<CargoResult> {
  return ipcRenderer.invoke('rust:run', workspaceRoot, options);
}

/**
 * Clean project
 */
export async function clean(workspaceRoot: string): Promise<CargoResult> {
  return ipcRenderer.invoke('rust:clean', workspaceRoot);
}

/**
 * Generate documentation
 */
export async function doc(workspaceRoot: string, open?: boolean): Promise<CargoResult> {
  return ipcRenderer.invoke('rust:doc', workspaceRoot, open);
}

// Export all functions as a namespace
export const rust = {
  checkRustInstallation,
  getToolchainInfo,
  runCargo,
  check: checkCode,
  clippy: runClippy,
  format: formatCode,
  formatString: formatCodeString,
  getCompletions,
  getProjectInfo,
  getDependencies,
  updateDependencies,
  updateConfig,
  getConfig,
  build,
  test,
  run,
  clean,
  doc,
};

// Expose to window
if (typeof window !== 'undefined') {
  (window as any).rust = rust;
}

export default rust;
