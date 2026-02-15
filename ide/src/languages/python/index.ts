// Python Language Support for IDE Kimi IDE
// Main exports

export { PythonLanguageProvider, PythonEnvironment, PythonPackage } from './PythonProvider';
export {
  PythonConfig,
  PythonVenvInfo,
  PythonDiagnostic,
  PythonCompletion,
  PythonSettings,
  PythonVenvType,
  PythonFormatter,
  PythonLinter,
  TypeCheckingMode,
} from './PythonConfig';
export { PythonStatusBar, pythonStatusBarStyles } from './PythonStatusBar';
export {
  setupPythonIPC,
  removePythonIPC,
  PythonIPCAPI,
} from './pythonIPC';

// Package.json contribution helpers
export function getPythonPackageJsonContribution() {
  return {
    configuration: {
      title: 'Python',
      properties: {
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
      },
    },
    commands: [
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
    ],
    menus: {
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
    },
    keybindings: [
      { command: 'python.runScript', key: 'ctrl+shift+r', when: 'editorTextFocus && editorLangId == python' },
      { command: 'python.runTests', key: 'ctrl+shift+t', when: 'editorTextFocus && editorLangId == python' },
      { command: 'python.selectInterpreter', key: 'ctrl+shift+p', when: 'editorTextFocus && editorLangId == python' },
    ],
    languages: [
      {
        id: 'python',
        aliases: ['Python', 'py'],
        extensions: ['.py', '.pyw', '.pyi'],
        firstLine: '^#!.*\\bpython[0-9.-]*\\b',
        configuration: './python-configuration.json',
      },
    ],
  };
}
