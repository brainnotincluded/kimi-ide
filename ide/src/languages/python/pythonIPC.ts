import { ipcMain, IpcMainInvokeEvent, dialog } from 'electron';
import * as path from 'path';
import { PythonLanguageProvider } from './PythonProvider';
import { PythonConfig } from './PythonConfig';

/**
 * Настройка IPC handlers для Python language support
 */
export function setupPythonIPC(provider: PythonLanguageProvider, config: PythonConfig): void {
  
  // ============ VENV HANDLERS ============
  
  /**
   * Детектировать виртуальные окружения в проекте
   * channel: python:detectVenvs
   */
  ipcMain.handle(
    'python:detectVenvs',
    async (_event: IpcMainInvokeEvent, projectPath?: string): Promise<{
      success: boolean;
      venvs: Array<{
        path: string;
        type: string;
        pythonPath: string;
        version: string;
        packageCount: number;
      }>;
      error?: string;
    }> => {
      try {
        const targetPath = projectPath || process.cwd();
        const venvs = await provider.detectVenv(targetPath);
        
        return {
          success: true,
          venvs: venvs.map(v => ({
            path: v.path,
            type: v.type,
            pythonPath: v.pythonPath,
            version: v.version,
            packageCount: v.packages.length,
          })),
        };
      } catch (error) {
        return {
          success: false,
          venvs: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  /**
   * Выбрать виртуальное окружение
   * channel: python:selectVenv
   */
  ipcMain.handle(
    'python:selectVenv',
    async (_event: IpcMainInvokeEvent, venvPath: string): Promise<{
      success: boolean;
      environment?: {
        path: string;
        version: string;
        venvPath: string;
        venvType: string;
      };
      error?: string;
    }> => {
      try {
        const env = await provider.activateVenv(venvPath);
        await config.setVenvPath(venvPath);
        
        return {
          success: true,
          environment: {
            path: env.path,
            version: env.version,
            venvPath: env.venvPath!,
            venvType: env.venvType!,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  /**
   * Получить список кешированных venv
   * channel: python:getCachedVenvs
   */
  ipcMain.handle(
    'python:getCachedVenvs',
    async (): Promise<{
      success: boolean;
      venvs: Array<{
        path: string;
        type: string;
        pythonPath: string;
        version: string;
        packageCount: number;
      }>;
    }> => {
      const venvs = provider.getCachedVenvs();
      return {
        success: true,
        venvs: venvs.map(v => ({
          path: v.path,
          type: v.type,
          pythonPath: v.pythonPath,
          version: v.version,
          packageCount: v.packages.length,
        })),
      };
    }
  );

  /**
   * Очистить кеш venv
   * channel: python:clearVenvCache
   */
  ipcMain.handle(
    'python:clearVenvCache',
    async (): Promise<{ success: boolean }> => {
      provider.clearVenvCache();
      return { success: true };
    }
  );

  // ============ PACKAGE HANDLERS ============

  /**
   * Установить пакеты
   * channel: python:installPackage
   */
  ipcMain.handle(
    'python:installPackage',
    async (
      _event: IpcMainInvokeEvent,
      packages: string[],
      options?: { upgrade?: boolean; dev?: boolean }
    ): Promise<{
      success: boolean;
      installed: string[];
      error?: string;
    }> => {
      try {
        await provider.installPackages(packages, options);
        return {
          success: true,
          installed: packages,
        };
      } catch (error) {
        return {
          success: false,
          installed: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  /**
   * Получить установленные пакеты
   * channel: python:getInstalledPackages
   */
  ipcMain.handle(
    'python:getInstalledPackages',
    async (_event: IpcMainInvokeEvent, pythonPath?: string): Promise<{
      success: boolean;
      packages: Array<{
        name: string;
        version: string;
      }>;
      error?: string;
    }> => {
      try {
        const packages = await provider.getInstalledPackages(pythonPath);
        return {
          success: true,
          packages,
        };
      } catch (error) {
        return {
          success: false,
          packages: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  /**
   * Показать диалог выбора для установки пакетов
   * channel: python:showInstallPackageDialog
   */
  ipcMain.handle(
    'python:showInstallPackageDialog',
    async (): Promise<{
      cancelled: boolean;
      packages?: string[];
    }> => {
      // В Electron показываем prompt через main window
      return {
        cancelled: true,
      };
    }
  );

  // ============ SCRIPT EXECUTION HANDLERS ============

  /**
   * Запустить Python скрипт
   * channel: python:runScript
   */
  ipcMain.handle(
    'python:runScript',
    async (
      _event: IpcMainInvokeEvent,
      scriptPath: string,
      args: string[] = []
    ): Promise<{
      success: boolean;
      stdout: string;
      stderr: string;
      exitCode: number;
      error?: string;
    }> => {
      try {
        const result = await provider.runScript(scriptPath, args);
        return {
          success: result.exitCode === 0,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        };
      } catch (error) {
        return {
          success: false,
          stdout: '',
          stderr: '',
          exitCode: -1,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  /**
   * Запустить текущий файл
   * channel: python:runCurrentFile
   */
  ipcMain.handle(
    'python:runCurrentFile',
    async (
      _event: IpcMainInvokeEvent,
      filePath: string,
      args: string[] = []
    ): Promise<{
      success: boolean;
      stdout: string;
      stderr: string;
      exitCode: number;
      error?: string;
    }> => {
      try {
        const result = await provider.runScript(filePath, args);
        return {
          success: result.exitCode === 0,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        };
      } catch (error) {
        return {
          success: false,
          stdout: '',
          stderr: '',
          exitCode: -1,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============ TEST HANDLERS ============

  /**
   * Запустить тесты
   * channel: python:runTests
   */
  ipcMain.handle(
    'python:runTests',
    async (
      _event: IpcMainInvokeEvent,
      testPath?: string,
      framework: 'pytest' | 'unittest' = 'pytest'
    ): Promise<{
      success: boolean;
      stdout: string;
      stderr: string;
      exitCode: number;
      error?: string;
    }> => {
      try {
        const result = await provider.runTests(testPath, framework);
        return {
          success: result.exitCode === 0,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        };
      } catch (error) {
        return {
          success: false,
          stdout: '',
          stderr: '',
          exitCode: -1,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  /**
   * Запустить тесты в текущем файле
   * channel: python:runTestsInFile
   */
  ipcMain.handle(
    'python:runTestsInFile',
    async (
      _event: IpcMainInvokeEvent,
      filePath: string
    ): Promise<{
      success: boolean;
      stdout: string;
      stderr: string;
      exitCode: number;
      error?: string;
    }> => {
      try {
        const result = await provider.runTests(filePath, 'pytest');
        return {
          success: result.exitCode === 0,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        };
      } catch (error) {
        return {
          success: false,
          stdout: '',
          stderr: '',
          exitCode: -1,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============ DIAGNOSTICS HANDLERS ============

  /**
   * Получить диагностику кода
   * channel: python:getDiagnostics
   */
  ipcMain.handle(
    'python:getDiagnostics',
    async (
      _event: IpcMainInvokeEvent,
      code: string,
      filePath?: string
    ): Promise<{
      success: boolean;
      diagnostics: Array<{
        line: number;
        column: number;
        message: string;
        code: string;
        severity: 'error' | 'warning' | 'info' | 'hint';
        source: string;
      }>;
      error?: string;
    }> => {
      try {
        const diagnostics = await provider.getDiagnostics(code, filePath);
        return {
          success: true,
          diagnostics,
        };
      } catch (error) {
        return {
          success: false,
          diagnostics: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============ FORMATTING HANDLERS ============

  /**
   * Форматировать код
   * channel: python:formatCode
   */
  ipcMain.handle(
    'python:formatCode',
    async (
      _event: IpcMainInvokeEvent,
      code: string,
      filePath?: string
    ): Promise<{
      success: boolean;
      formattedCode: string;
      error?: string;
    }> => {
      try {
        const formattedCode = await provider.formatCode(code, filePath);
        return {
          success: true,
          formattedCode,
        };
      } catch (error) {
        return {
          success: false,
          formattedCode: code,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============ COMPLETION HANDLERS ============

  /**
   * Получить completions для позиции
   * channel: python:getCompletions
   */
  ipcMain.handle(
    'python:getCompletions',
    async (
      _event: IpcMainInvokeEvent,
      code: string,
      position: { line: number; character: number }
    ): Promise<{
      success: boolean;
      completions: Array<{
        label: string;
        kind: string;
        detail?: string;
        documentation?: string;
        insertText?: string;
      }>;
      error?: string;
    }> => {
      try {
        const completions = await provider.getCompletions(code, position);
        return {
          success: true,
          completions,
        };
      } catch (error) {
        return {
          success: false,
          completions: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // ============ INTERPRETER HANDLERS ============

  /**
   * Получить путь к Python интерпретатору
   * channel: python:getPythonPath
   */
  ipcMain.handle(
    'python:getPythonPath',
    async (): Promise<{
      success: boolean;
      pythonPath: string | null;
      isVenv: boolean;
    }> => {
      const pythonPath = provider.getPythonExecutable();
      const activeEnv = provider.getActiveEnvironment();
      return {
        success: true,
        pythonPath,
        isVenv: !!activeEnv?.venvPath,
      };
    }
  );

  /**
   * Выбрать системный интерпретатор через диалог
   * channel: python:browseSystemInterpreter
   */
  ipcMain.handle(
    'python:browseSystemInterpreter',
    async (): Promise<{
      success: boolean;
      pythonPath?: string;
      cancelled?: boolean;
      error?: string;
    }> => {
      const result = await dialog.showOpenDialog({
        title: 'Select Python Interpreter',
        properties: ['openFile'],
        filters: process.platform === 'win32'
          ? [{ name: 'Python', extensions: ['exe'] }]
          : undefined,
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, cancelled: true };
      }

      const pythonPath = result.filePaths[0];
      await config.setPythonPath(pythonPath);

      return {
        success: true,
        pythonPath,
      };
    }
  );

  /**
   * Получить активное окружение
   * channel: python:getActiveEnvironment
   */
  ipcMain.handle(
    'python:getActiveEnvironment',
    async (): Promise<{
      success: boolean;
      environment?: {
        path: string;
        version: string;
        venvPath?: string;
        venvType?: string;
      } | null;
    }> => {
      const env = provider.getActiveEnvironment();
      return {
        success: true,
        environment: env ? {
          path: env.path,
          version: env.version,
          venvPath: env.venvPath,
          venvType: env.venvType,
        } : null,
      };
    }
  );

  // ============ CONFIGURATION HANDLERS ============

  /**
   * Получить настройки Python
   * channel: python:getSettings
   */
  ipcMain.handle(
    'python:getSettings',
    async (): Promise<{
      success: boolean;
      settings: ReturnType<PythonConfig['getAllSettings']>;
    }> => {
      return {
        success: true,
        settings: config.getAllSettings(),
      };
    }
  );

  /**
   * Обновить настройку
   * channel: python:updateSetting
   */
  ipcMain.handle(
    'python:updateSetting',
    async (
      _event: IpcMainInvokeEvent,
      key: string,
      value: unknown
    ): Promise<{
      success: boolean;
      error?: string;
    }> => {
      try {
        switch (key) {
          case 'pythonPath':
            await config.setPythonPath(value as string | null);
            break;
          case 'venvPath':
            await config.setVenvPath(value as string | null);
            break;
          case 'formatter':
            await config.setFormatter(value as 'black' | 'ruff' | 'autopep8');
            break;
          case 'linter':
            await config.setLinter(value as 'ruff' | 'flake8' | 'pylint' | 'mypy');
            break;
          case 'typeChecking':
            await config.setTypeCheckingMode(value as 'basic' | 'strict' | 'off');
            break;
          default:
            throw new Error(`Unknown setting: ${key}`);
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}

/**
 * Удалить все Python IPC handlers
 */
export function removePythonIPC(): void {
  const channels = [
    'python:detectVenvs',
    'python:selectVenv',
    'python:getCachedVenvs',
    'python:clearVenvCache',
    'python:installPackage',
    'python:getInstalledPackages',
    'python:showInstallPackageDialog',
    'python:runScript',
    'python:runCurrentFile',
    'python:runTests',
    'python:runTestsInFile',
    'python:getDiagnostics',
    'python:formatCode',
    'python:getCompletions',
    'python:getPythonPath',
    'python:browseSystemInterpreter',
    'python:getActiveEnvironment',
    'python:getSettings',
    'python:updateSetting',
  ];

  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }
}

/**
 * IPC API типы для preload script
 */
export interface PythonIPCAPI {
  detectVenvs: (projectPath?: string) => Promise<{
    success: boolean;
    venvs: Array<{
      path: string;
      type: string;
      pythonPath: string;
      version: string;
      packageCount: number;
    }>;
    error?: string;
  }>;
  
  selectVenv: (venvPath: string) => Promise<{
    success: boolean;
    environment?: {
      path: string;
      version: string;
      venvPath: string;
      venvType: string;
    };
    error?: string;
  }>;
  
  getCachedVenvs: () => Promise<{
    success: boolean;
    venvs: Array<{
      path: string;
      type: string;
      pythonPath: string;
      version: string;
      packageCount: number;
    }>;
  }>;
  
  clearVenvCache: () => Promise<{ success: boolean }>;
  
  installPackage: (
    packages: string[],
    options?: { upgrade?: boolean; dev?: boolean }
  ) => Promise<{
    success: boolean;
    installed: string[];
    error?: string;
  }>;
  
  getInstalledPackages: (pythonPath?: string) => Promise<{
    success: boolean;
    packages: Array<{ name: string; version: string }>;
    error?: string;
  }>;
  
  runScript: (
    scriptPath: string,
    args?: string[]
  ) => Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
  }>;
  
  runCurrentFile: (
    filePath: string,
    args?: string[]
  ) => Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
  }>;
  
  runTests: (
    testPath?: string,
    framework?: 'pytest' | 'unittest'
  ) => Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
  }>;
  
  runTestsInFile: (filePath: string) => Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
  }>;
  
  getDiagnostics: (
    code: string,
    filePath?: string
  ) => Promise<{
    success: boolean;
    diagnostics: Array<{
      line: number;
      column: number;
      message: string;
      code: string;
      severity: 'error' | 'warning' | 'info' | 'hint';
      source: string;
    }>;
    error?: string;
  }>;
  
  formatCode: (
    code: string,
    filePath?: string
  ) => Promise<{
    success: boolean;
    formattedCode: string;
    error?: string;
  }>;
  
  getCompletions: (
    code: string,
    position: { line: number; character: number }
  ) => Promise<{
    success: boolean;
    completions: Array<{
      label: string;
      kind: string;
      detail?: string;
      documentation?: string;
      insertText?: string;
    }>;
    error?: string;
  }>;
  
  getPythonPath: () => Promise<{
    success: boolean;
    pythonPath: string | null;
    isVenv: boolean;
  }>;
  
  browseSystemInterpreter: () => Promise<{
    success: boolean;
    pythonPath?: string;
    cancelled?: boolean;
    error?: string;
  }>;
  
  getActiveEnvironment: () => Promise<{
    success: boolean;
    environment?: {
      path: string;
      version: string;
      venvPath?: string;
      venvType?: string;
    } | null;
  }>;
  
  getSettings: () => Promise<{
    success: boolean;
    settings: ReturnType<PythonConfig['getAllSettings']>;
  }>;
  
  updateSetting: (
    key: string,
    value: unknown
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;
}
