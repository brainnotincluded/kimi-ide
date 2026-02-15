import * as vscode from 'vscode';

export type PythonVenvType = 'venv' | 'pipenv' | 'poetry' | 'conda' | 'system';
export type PythonFormatter = 'black' | 'ruff' | 'autopep8' | 'none';
export type PythonLinter = 'ruff' | 'flake8' | 'pylint' | 'mypy' | 'none';
export type TypeCheckingMode = 'basic' | 'strict' | 'off';

export interface PythonVenvInfo {
  path: string;
  type: PythonVenvType;
  pythonPath: string;
  version: string;
  packages: PythonPackage[];
}

export interface PythonPackage {
  name: string;
  version: string;
  latest?: string;
}

export interface PythonDiagnostic {
  line: number;
  column: number;
  message: string;
  code: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  source: string;
}

export interface PythonCompletion {
  label: string;
  kind: string;
  detail?: string;
  documentation?: string;
  insertText?: string;
}

export interface PythonSettings {
  pythonPath: string | null;
  venvPath: string | null;
  formatter: PythonFormatter;
  linter: PythonLinter;
  typeChecking: TypeCheckingMode;
  autoActivateVenv: boolean;
  showInStatusBar: boolean;
  analysis: {
    typeCheckingMode: TypeCheckingMode;
    autoImportCompletions: boolean;
    extraPaths: string[];
    stubPath: string | null;
  };
  formatting: {
    provider: PythonFormatter;
    black: {
      args: string[];
      path: string | null;
    };
    ruff: {
      args: string[];
      path: string | null;
    };
    autopep8: {
      args: string[];
      path: string | null;
    };
  };
  linting: {
    enabled: boolean;
    pylintEnabled: boolean;
    flake8Enabled: boolean;
    mypyEnabled: boolean;
    ruffEnabled: boolean;
    pylintArgs: string[];
    flake8Args: string[];
    mypyArgs: string[];
    ruffArgs: string[];
  };
}

export class PythonConfig {
  private static readonly CONFIG_SECTION = 'python';
  private config: vscode.WorkspaceConfiguration;

  constructor() {
    this.config = vscode.workspace.getConfiguration(PythonConfig.CONFIG_SECTION);
    this.setupConfigChangeListener();
  }

  /**
   * Получить путь к Python интерпретатору
   */
  getPythonPath(): string | null {
    return this.config.get<string | null>('pythonPath', null);
  }

  /**
   * Установить путь к Python интерпретатору
   */
  async setPythonPath(pythonPath: string | null): Promise<void> {
    await this.config.update('pythonPath', pythonPath, true);
  }

  /**
   * Получить путь к виртуальному окружению
   */
  getVenvPath(): string | null {
    return this.config.get<string | null>('venvPath', null);
  }

  /**
   * Установить путь к виртуальному окружению
   */
  async setVenvPath(venvPath: string | null): Promise<void> {
    await this.config.update('venvPath', venvPath, true);
  }

  /**
   * Получить форматтер
   */
  getFormatter(): PythonFormatter {
    return this.config.get<PythonFormatter>('formatter', 'black');
  }

  /**
   * Установить форматтер
   */
  async setFormatter(formatter: PythonFormatter): Promise<void> {
    await this.config.update('formatter', formatter, true);
  }

  /**
   * Получить линтер
   */
  getLinter(): PythonLinter {
    return this.config.get<PythonLinter>('linter', 'ruff');
  }

  /**
   * Установить линтер
   */
  async setLinter(linter: PythonLinter): Promise<void> {
    await this.config.update('linter', linter, true);
  }

  /**
   * Получить режим проверки типов
   */
  getTypeCheckingMode(): TypeCheckingMode {
    return this.config.get<TypeCheckingMode>('analysis.typeChecking', 'basic');
  }

  /**
   * Установить режим проверки типов
   */
  async setTypeCheckingMode(mode: TypeCheckingMode): Promise<void> {
    await this.config.update('analysis.typeChecking', mode, true);
  }

  /**
   * Проверить автоматическую активацию venv
   */
  getAutoActivateVenv(): boolean {
    return this.config.get<boolean>('autoActivateVenv', true);
  }

  /**
   * Показывать ли Python в статус баре
   */
  getShowInStatusBar(): boolean {
    return this.config.get<boolean>('showInStatusBar', true);
  }

  /**
   * Получить настройки анализа
   */
  getAnalysisSettings(): PythonSettings['analysis'] {
    return {
      typeCheckingMode: this.getTypeCheckingMode(),
      autoImportCompletions: this.config.get<boolean>('analysis.autoImportCompletions', true),
      extraPaths: this.config.get<string[]>('analysis.extraPaths', []),
      stubPath: this.config.get<string | null>('analysis.stubPath', null),
    };
  }

  /**
   * Получить настройки форматирования
   */
  getFormattingSettings(): PythonSettings['formatting'] {
    return {
      provider: this.getFormatter(),
      black: {
        args: this.config.get<string[]>('formatting.black.args', []),
        path: this.config.get<string | null>('formatting.black.path', null),
      },
      ruff: {
        args: this.config.get<string[]>('formatting.ruff.args', []),
        path: this.config.get<string | null>('formatting.ruff.path', null),
      },
      autopep8: {
        args: this.config.get<string[]>('formatting.autopep8.args', []),
        path: this.config.get<string | null>('formatting.autopep8.path', null),
      },
    };
  }

  /**
   * Получить настройки линтинга
   */
  getLintingSettings(): PythonSettings['linting'] {
    return {
      enabled: this.config.get<boolean>('linting.enabled', true),
      pylintEnabled: this.config.get<boolean>('linting.pylintEnabled', false),
      flake8Enabled: this.config.get<boolean>('linting.flake8Enabled', false),
      mypyEnabled: this.config.get<boolean>('linting.mypyEnabled', false),
      ruffEnabled: this.config.get<boolean>('linting.ruffEnabled', true),
      pylintArgs: this.config.get<string[]>('linting.pylintArgs', []),
      flake8Args: this.config.get<string[]>('linting.flake8Args', []),
      mypyArgs: this.config.get<string[]>('linting.mypyArgs', []),
      ruffArgs: this.config.get<string[]>('linting.ruffArgs', []),
    };
  }

  /**
   * Получить все настройки Python
   */
  getAllSettings(): PythonSettings {
    return {
      pythonPath: this.getPythonPath(),
      venvPath: this.getVenvPath(),
      formatter: this.getFormatter(),
      linter: this.getLinter(),
      typeChecking: this.getTypeCheckingMode(),
      autoActivateVenv: this.getAutoActivateVenv(),
      showInStatusBar: this.getShowInStatusBar(),
      analysis: this.getAnalysisSettings(),
      formatting: this.getFormattingSettings(),
      linting: this.getLintingSettings(),
    };
  }

  /**
   * Получить настройки по умолчанию для package.json
   */
  static getDefaultConfiguration(): Record<string, unknown> {
    return {
      'python.pythonPath': {
        type: ['string', 'null'],
        default: null,
        description: 'Path to Python interpreter',
        scope: 'resource',
      },
      'python.venvPath': {
        type: ['string', 'null'],
        default: null,
        description: 'Path to virtual environment',
        scope: 'resource',
      },
      'python.formatter': {
        type: 'string',
        enum: ['black', 'ruff', 'autopep8', 'none'],
        default: 'black',
        description: 'Code formatter to use',
        enumDescriptions: [
          'Use Black formatter',
          'Use Ruff formatter',
          'Use Autopep8 formatter',
          'Disable formatting',
        ],
      },
      'python.linter': {
        type: 'string',
        enum: ['ruff', 'flake8', 'pylint', 'mypy', 'none'],
        default: 'ruff',
        description: 'Linter to use for code analysis',
        enumDescriptions: [
          'Use Ruff linter (fast, modern)',
          'Use Flake8 linter',
          'Use Pylint linter',
          'Use MyPy type checker',
          'Disable linting',
        ],
      },
      'python.analysis.typeChecking': {
        type: 'string',
        enum: ['basic', 'strict', 'off'],
        default: 'basic',
        description: 'Type checking mode',
        enumDescriptions: [
          'Basic type checking',
          'Strict type checking',
          'Disable type checking',
        ],
      },
      'python.autoActivateVenv': {
        type: 'boolean',
        default: true,
        description: 'Automatically activate virtual environment when detected',
      },
      'python.showInStatusBar': {
        type: 'boolean',
        default: true,
        description: 'Show Python interpreter info in status bar',
      },
      'python.analysis.autoImportCompletions': {
        type: 'boolean',
        default: true,
        description: 'Enable auto-import completions',
      },
      'python.analysis.extraPaths': {
        type: 'array',
        items: { type: 'string' },
        default: [],
        description: 'Extra paths for Python analysis',
      },
      'python.analysis.stubPath': {
        type: ['string', 'null'],
        default: null,
        description: 'Path to stubs directory',
      },
      'python.formatting.black.args': {
        type: 'array',
        items: { type: 'string' },
        default: [],
        description: 'Arguments for Black formatter',
      },
      'python.formatting.black.path': {
        type: ['string', 'null'],
        default: null,
        description: 'Custom path to Black executable',
      },
      'python.formatting.ruff.args': {
        type: 'array',
        items: { type: 'string' },
        default: [],
        description: 'Arguments for Ruff formatter',
      },
      'python.formatting.ruff.path': {
        type: ['string', 'null'],
        default: null,
        description: 'Custom path to Ruff executable',
      },
      'python.formatting.autopep8.args': {
        type: 'array',
        items: { type: 'string' },
        default: [],
        description: 'Arguments for Autopep8 formatter',
      },
      'python.formatting.autopep8.path': {
        type: ['string', 'null'],
        default: null,
        description: 'Custom path to Autopep8 executable',
      },
      'python.linting.enabled': {
        type: 'boolean',
        default: true,
        description: 'Enable linting',
      },
      'python.linting.pylintEnabled': {
        type: 'boolean',
        default: false,
        description: 'Enable Pylint',
      },
      'python.linting.flake8Enabled': {
        type: 'boolean',
        default: false,
        description: 'Enable Flake8',
      },
      'python.linting.mypyEnabled': {
        type: 'boolean',
        default: false,
        description: 'Enable MyPy',
      },
      'python.linting.ruffEnabled': {
        type: 'boolean',
        default: true,
        description: 'Enable Ruff',
      },
      'python.linting.pylintArgs': {
        type: 'array',
        items: { type: 'string' },
        default: [],
        description: 'Arguments for Pylint',
      },
      'python.linting.flake8Args': {
        type: 'array',
        items: { type: 'string' },
        default: [],
        description: 'Arguments for Flake8',
      },
      'python.linting.mypyArgs': {
        type: 'array',
        items: { type: 'string' },
        default: [],
        description: 'Arguments for MyPy',
      },
      'python.linting.ruffArgs': {
        type: 'array',
        items: { type: 'string' },
        default: [],
        description: 'Arguments for Ruff',
      },
    };
  }

  /**
   * Получить команды для package.json contributes
   */
  static getCommands(): Array<{ command: string; title: string; category: string }> {
    return [
      { command: 'python.selectInterpreter', title: 'Select Interpreter', category: 'Python' },
      { command: 'python.selectVenv', title: 'Select Virtual Environment', category: 'Python' },
      { command: 'python.createVenv', title: 'Create Virtual Environment', category: 'Python' },
      { command: 'python.installPackages', title: 'Install Packages', category: 'Python' },
      { command: 'python.runScript', title: 'Run Python Script', category: 'Python' },
      { command: 'python.runTests', title: 'Run Tests', category: 'Python' },
      { command: 'python.formatDocument', title: 'Format Document', category: 'Python' },
      { command: 'python.organizeImports', title: 'Organize Imports', category: 'Python' },
      { command: 'python.openRepl', title: 'Open Python REPL', category: 'Python' },
      { command: 'python.clearCache', title: 'Clear Language Server Cache', category: 'Python' },
      { command: 'python.showOutput', title: 'Show Python Output', category: 'Python' },
    ];
  }

  /**
   * Получить меню для package.json contributes
   */
  static getMenus(): Record<string, unknown> {
    return {
      'commandPalette': [
        { command: 'python.selectInterpreter', when: 'editorLangId == python' },
        { command: 'python.selectVenv', when: 'editorLangId == python' },
        { command: 'python.createVenv', when: 'editorLangId == python' },
        { command: 'python.installPackages', when: 'editorLangId == python' },
        { command: 'python.runScript', when: 'editorLangId == python' },
        { command: 'python.runTests', when: 'editorLangId == python' },
      ],
      'editor/context': [
        {
          when: 'editorLangId == python',
          command: 'python.runScript',
          group: '2_run@1',
        },
        {
          when: 'editorLangId == python',
          command: 'python.formatDocument',
          group: '1_modification@1',
        },
      ],
    };
  }

  /**
   * Получить keybindings для package.json contributes
   */
  static getKeybindings(): Array<{ command: string; key: string; when: string }> {
    return [
      { command: 'python.runScript', key: 'ctrl+shift+r', when: 'editorTextFocus && editorLangId == python' },
      { command: 'python.runTests', key: 'ctrl+shift+t', when: 'editorTextFocus && editorLangId == python' },
      { command: 'python.selectInterpreter', key: 'ctrl+shift+p', when: 'editorTextFocus && editorLangId == python' },
    ];
  }

  private setupConfigChangeListener(): void {
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(PythonConfig.CONFIG_SECTION)) {
        this.config = vscode.workspace.getConfiguration(PythonConfig.CONFIG_SECTION);
      }
    });
  }

  /**
   * Обновить конфигурацию
   */
  refresh(): void {
    this.config = vscode.workspace.getConfiguration(PythonConfig.CONFIG_SECTION);
  }
}
