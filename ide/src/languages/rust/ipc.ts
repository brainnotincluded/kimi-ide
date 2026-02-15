/**
 * Rust Language Support IPC Handlers
 * Main process IPC handlers for Rust integration
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { RustLanguageProvider, getRustProvider } from './provider';
import { CargoCommand, CargoOptions, RustConfiguration } from './types';

// Active providers per workspace
const providers = new Map<string, RustLanguageProvider>();

/**
 * Get or create provider for workspace
 */
function getProvider(workspaceRoot: string): RustLanguageProvider {
  if (!providers.has(workspaceRoot)) {
    providers.set(workspaceRoot, new RustLanguageProvider(workspaceRoot));
  }
  return providers.get(workspaceRoot)!;
}

/**
 * Setup all IPC handlers for Rust language support
 */
export function setupRustIPCHandlers(): void {
  // Check Rust installation
  ipcMain.handle('rust:checkInstallation', async () => {
    try {
      const tempProvider = new RustLanguageProvider(process.cwd());
      return await tempProvider.checkRustInstallation();
    } catch (error) {
      return {
        installed: false,
        rustup: false,
        cargo: false,
        rustc: false,
        rustfmt: false,
        rustAnalyzer: false,
        errors: [(error as Error).message],
      };
    }
  });

  // Get toolchain info
  ipcMain.handle('rust:getToolchainInfo', async () => {
    try {
      const tempProvider = new RustLanguageProvider(process.cwd());
      return await tempProvider.getToolchainInfo();
    } catch (error) {
      return null;
    }
  });

  // Run cargo command
  ipcMain.handle(
    'rust:runCargo',
    async (
      _: IpcMainInvokeEvent,
      workspaceRoot: string,
      command: CargoCommand,
      options?: CargoOptions
    ) => {
      const provider = getProvider(workspaceRoot);
      return await provider.runCargo(command, options || {});
    }
  );

  // Check code (cargo check)
  ipcMain.handle('rust:check', async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
    const provider = getProvider(workspaceRoot);
    return await provider.getDiagnostics();
  });

  // Run clippy
  ipcMain.handle('rust:clippy', async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
    const provider = getProvider(workspaceRoot);
    return await provider.getClippyDiagnostics();
  });

  // Format code
  ipcMain.handle(
    'rust:format',
    async (_: IpcMainInvokeEvent, filePath: string) => {
      const provider = getProvider(process.cwd());
      return await provider.formatCode(filePath);
    }
  );

  // Format code string
  ipcMain.handle(
    'rust:formatString',
    async (_: IpcMainInvokeEvent, code: string) => {
      const provider = getProvider(process.cwd());
      return await provider.formatCodeString(code);
    }
  );

  // Get completions
  ipcMain.handle(
    'rust:getCompletions',
    async (_: IpcMainInvokeEvent, filePath: string, line: number, column: number) => {
      const provider = getProvider(process.cwd());
      return await provider.getCompletions(filePath, line, column);
    }
  );

  // Get project info
  ipcMain.handle('rust:getProjectInfo', async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
    const provider = getProvider(workspaceRoot);
    return {
      isRustProject: provider.isRustProject(),
      projectName: provider.getProjectName(),
      cargoToml: provider.parseCargoToml(),
      dependencies: provider.getDependencies(),
      availableFeatures: provider.getAvailableFeatures(),
    };
  });

  // Get dependencies
  ipcMain.handle('rust:getDependencies', async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
    const provider = getProvider(workspaceRoot);
    return provider.getDependencies();
  });

  // Update dependencies
  ipcMain.handle('rust:updateDependencies', async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
    const provider = getProvider(workspaceRoot);
    return await provider.updateDependencies();
  });

  // Update configuration
  ipcMain.handle(
    'rust:updateConfig',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, config: Partial<RustConfiguration>) => {
      const provider = getProvider(workspaceRoot);
      provider.updateConfig(config);
      return provider.getConfig();
    }
  );

  // Get configuration
  ipcMain.handle('rust:getConfig', async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
    const provider = getProvider(workspaceRoot);
    return provider.getConfig();
  });

  // Build project
  ipcMain.handle(
    'rust:build',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, release?: boolean) => {
      const provider = getProvider(workspaceRoot);
      return await provider.runCargo('build', { release });
    }
  );

  // Test project
  ipcMain.handle(
    'rust:test',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, options?: CargoOptions) => {
      const provider = getProvider(workspaceRoot);
      return await provider.runCargo('test', options || {});
    }
  );

  // Run project
  ipcMain.handle(
    'rust:run',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, options?: CargoOptions) => {
      const provider = getProvider(workspaceRoot);
      return await provider.runCargo('run', options || {});
    }
  );

  // Clean project
  ipcMain.handle('rust:clean', async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
    const provider = getProvider(workspaceRoot);
    return await provider.runCargo('clean', {});
  });

  // Generate documentation
  ipcMain.handle(
    'rust:doc',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, open?: boolean) => {
      const provider = getProvider(workspaceRoot);
      return await provider.runCargo('doc', { args: open ? ['--open'] : [] });
    }
  );
}

/**
 * Cleanup all Rust providers
 */
export function cleanupRustProviders(): void {
  providers.clear();
}
