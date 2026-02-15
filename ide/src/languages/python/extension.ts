import * as vscode from 'vscode';
import { PythonLanguageProvider } from './PythonProvider';
import { PythonConfig } from './PythonConfig';
import { setupPythonIPC } from './pythonIPC';

let pythonProvider: PythonLanguageProvider | null = null;
let pythonConfig: PythonConfig | null = null;

/**
 * Активация Python language support
 */
export async function activatePythonSupport(context: vscode.ExtensionContext): Promise<void> {
  console.log('Activating Python Language Support...');

  // Инициализация конфигурации
  pythonConfig = new PythonConfig();

  // Инициализация провайдера
  pythonProvider = new PythonLanguageProvider(pythonConfig);

  // Настройка IPC handlers (для Electron)
  setupPythonIPC(pythonProvider, pythonConfig);

  // Регистрация провайдера языка
  registerLanguageFeatures(context);

  // Регистрация команд
  registerCommands(context);

  // Автодетект и активация venv
  await autoDetectAndActivateVenv();

  console.log('Python Language Support activated successfully');
}

/**
 * Деактивация Python language support
 */
export function deactivatePythonSupport(): void {
  if (pythonProvider) {
    pythonProvider.removeAllListeners();
    pythonProvider = null;
  }
  pythonConfig = null;
}

/**
 * Регистрация language features
 */
function registerLanguageFeatures(context: vscode.ExtensionContext): void {
  if (!pythonProvider || !pythonConfig) return;

  // Document Symbol Provider
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider('python', {
      provideDocumentSymbols(document) {
        const symbols: vscode.DocumentSymbol[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Парсим классы
          const classMatch = line.match(/^class\s+(\w+)(?:\(([^)]*)\))?:/);
          if (classMatch) {
            const symbol = new vscode.DocumentSymbol(
              classMatch[1],
              classMatch[2] || '',
              vscode.SymbolKind.Class,
              new vscode.Range(i, 0, i, line.length),
              new vscode.Range(i, 0, i, line.length)
            );
            symbols.push(symbol);
          }

          // Парсим функции
          const funcMatch = line.match(/^(async\s+)?def\s+(\w+)\s*\(/);
          if (funcMatch) {
            const symbol = new vscode.DocumentSymbol(
              funcMatch[2],
              '',
              funcMatch[1] ? vscode.SymbolKind.Method : vscode.SymbolKind.Function,
              new vscode.Range(i, 0, i, line.length),
              new vscode.Range(i, 0, i, line.length)
            );
            symbols.push(symbol);
          }
        }

        return symbols;
      },
    })
  );

  // Completion Provider
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      'python',
      {
        async provideCompletionItems(document, position) {
          const code = document.getText();
          const pos = { line: position.line, character: position.character };
          
          try {
            const completions = await pythonProvider!.getCompletions(code, pos);
            
            return completions.map(comp => {
              const item = new vscode.CompletionItem(
                comp.label,
                mapCompletionKind(comp.kind)
              );
              item.detail = comp.detail;
              item.documentation = comp.documentation;
              if (comp.insertText) {
                item.insertText = comp.insertText;
              }
              return item;
            });
          } catch {
            return [];
          }
        },
      },
      '.',
      '"',
      "'"
    )
  );

  // Hover Provider
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('python', {
      provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position);
        if (!range) return null;
        
        const word = document.getText(range);
        
        // Базовая документация для встроенных функций
        const builtins: Record<string, string> = {
          'print': 'print(*objects, sep=" ", end="\\n", file=sys.stdout, flush=False)\n\nPrint objects to the text stream.',
          'len': 'len(s) -> int\n\nReturn the number of items in a container.',
          'range': 'range(stop) / range(start, stop[, step])\n\nReturn an object that produces a sequence of integers.',
          'enumerate': 'enumerate(iterable, start=0)\n\nReturn an enumerate object.',
          'zip': 'zip(*iterables)\n\nMake an iterator that aggregates elements from each of the iterables.',
          'map': 'map(function, iterable, ...)\n\nMake an iterator that computes the function using arguments from each of the iterables.',
          'filter': 'filter(function, iterable)\n\nReturn an iterator yielding those items of iterable for which function(item) is true.',
          'sum': 'sum(iterable, /, start=0)\n\nReturn the sum of a \'start\' value (default: 0) plus an iterable of numbers.',
        };

        if (builtins[word]) {
          return new vscode.Hover(new vscode.MarkdownString(builtins[word]));
        }

        return null;
      },
    })
  );

  // Formatting Provider
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('python', {
      async provideDocumentFormattingEdits(document) {
        if (pythonConfig!.getFormatter() === 'none') {
          return [];
        }

        const code = document.getText();
        const formattedCode = await pythonProvider!.formatCode(code, document.fileName);
        
        if (formattedCode !== code) {
          const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(code.length)
          );
          return [vscode.TextEdit.replace(fullRange, formattedCode)];
        }
        
        return [];
      },
    })
  );

  // Diagnostics (Linting)
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('python');
  context.subscriptions.push(diagnosticCollection);

  // Обновление диагностик при изменении документа
  const updateDiagnostics = async (document: vscode.TextDocument) => {
    if (document.languageId !== 'python' || pythonConfig!.getLinter() === 'none') {
      return;
    }

    const code = document.getText();
    const diagnostics = await pythonProvider!.getDiagnostics(code, document.fileName);
    
    const vscodeDiagnostics: vscode.Diagnostic[] = diagnostics.map(d => {
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(d.line - 1, d.column, d.line - 1, d.column + 1),
        `[${d.code}] ${d.message}`,
        mapDiagnosticSeverity(d.severity)
      );
      diagnostic.source = d.source;
      return diagnostic;
    });

    diagnosticCollection.set(document.uri, vscodeDiagnostics);
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      updateDiagnostics(e.document);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(updateDiagnostics)
  );

  // Очистка диагностик при закрытии
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(doc => {
      diagnosticCollection.delete(doc.uri);
    })
  );
}

/**
 * Регистрация команд
 */
function registerCommands(context: vscode.ExtensionContext): void {
  if (!pythonProvider || !pythonConfig) return;

  // Select Interpreter
  context.subscriptions.push(
    vscode.commands.registerCommand('python.selectInterpreter', async () => {
      const venvs = pythonProvider!.getCachedVenvs();
      
      const items = venvs.map(v => ({
        label: `${v.type === 'venv' ? '🔧' : v.type === 'poetry' ? '📦' : v.type === 'pipenv' ? '🐍' : '🅒'} ${v.path.split(/[/\\]/).pop()}`,
        description: `Python ${v.version}`,
        detail: v.path,
        venv: v,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select Python interpreter',
      });

      if (selected) {
        await pythonProvider!.activateVenv(selected.venv.path);
        await pythonConfig!.setVenvPath(selected.venv.path);
        vscode.window.showInformationMessage(`Activated: ${selected.label}`);
      }
    })
  );

  // Select Venv
  context.subscriptions.push(
    vscode.commands.registerCommand('python.selectVenv', async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Detecting virtual environments...',
      }, async () => {
        const venvs = await pythonProvider!.detectVenv(folders[0].uri.fsPath);
        
        const items = venvs.map(v => ({
          label: `${v.type === 'venv' ? '🔧' : v.type === 'poetry' ? '📦' : v.type === 'pipenv' ? '🐍' : '🅒'} ${v.path.split(/[/\\]/).pop()}`,
          description: `Python ${v.version} • ${v.packages.length} packages`,
          detail: v.path,
          venv: v,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select virtual environment',
        });

        if (selected) {
          await pythonProvider!.activateVenv(selected.venv.path);
          await pythonConfig!.setVenvPath(selected.venv.path);
          vscode.window.showInformationMessage(`Activated: ${selected.label}`);
        }
      });
    })
  );

  // Create Venv
  context.subscriptions.push(
    vscode.commands.registerCommand('python.createVenv', async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
      }

      const venvName = await vscode.window.showInputBox({
        prompt: 'Enter virtual environment name',
        value: '.venv',
      });

      if (!venvName) return;

      const terminal = vscode.window.createTerminal('Create Venv');
      terminal.sendText(`python -m venv ${venvName}`);
      terminal.show();
    })
  );

  // Install Packages
  context.subscriptions.push(
    vscode.commands.registerCommand('python.installPackages', async () => {
      const packageInput = await vscode.window.showInputBox({
        prompt: 'Enter package names (comma or space separated)',
        placeHolder: 'requests, numpy, pandas',
      });

      if (!packageInput) return;

      const packages = packageInput.split(/[,\s]+/).filter(p => p.trim());
      
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Installing ${packages.join(', ')}...`,
      }, async () => {
        try {
          await pythonProvider!.installPackages(packages);
          vscode.window.showInformationMessage(`Installed: ${packages.join(', ')}`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to install: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });
    })
  );

  // Run Script
  context.subscriptions.push(
    vscode.commands.registerCommand('python.runScript', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'python') {
        vscode.window.showWarningMessage('No Python file open');
        return;
      }

      const filePath = editor.document.fileName;
      
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Running Python script...',
      }, async () => {
        const result = await pythonProvider!.runScript(filePath);
        
        if (result.exitCode === 0) {
          const channel = vscode.window.createOutputChannel('Python');
          channel.appendLine(result.stdout);
          if (result.stderr) {
            channel.appendLine('STDERR:');
            channel.appendLine(result.stderr);
          }
          channel.show();
        } else {
          vscode.window.showErrorMessage(`Script failed with exit code ${result.exitCode}`);
        }
      });
    })
  );

  // Run Tests
  context.subscriptions.push(
    vscode.commands.registerCommand('python.runTests', async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Running tests...',
      }, async () => {
        const result = await pythonProvider!.runTests(folders![0].uri.fsPath);
        
        const channel = vscode.window.createOutputChannel('Python Tests');
        channel.appendLine(result.stdout);
        if (result.stderr) {
          channel.appendLine('STDERR:');
          channel.appendLine(result.stderr);
        }
        channel.show();

        if (result.exitCode === 0) {
          vscode.window.showInformationMessage('All tests passed!');
        } else {
          vscode.window.showWarningMessage('Some tests failed');
        }
      });
    })
  );

  // Format Document
  context.subscriptions.push(
    vscode.commands.registerCommand('python.formatDocument', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'python') {
        return;
      }

      await vscode.commands.executeCommand('editor.action.formatDocument');
    })
  );

  // Organize Imports
  context.subscriptions.push(
    vscode.commands.registerCommand('python.organizeImports', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'python') {
        return;
      }

      // Базовая сортировка импортов
      const code = editor.document.getText();
      const lines = code.split('\n');
      const imports = lines.filter(l => l.match(/^(import|from)\s+/));
      const otherLines = lines.filter(l => !l.match(/^(import|from)\s+/));
      
      const sortedImports = imports.sort();
      const newCode = [...sortedImports, '', ...otherLines].join('\n');

      const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(code.length)
      );

      await editor.edit(editBuilder => {
        editBuilder.replace(fullRange, newCode);
      });
    })
  );

  // Open REPL
  context.subscriptions.push(
    vscode.commands.registerCommand('python.openRepl', () => {
      const terminal = vscode.window.createTerminal('Python REPL');
      terminal.sendText('python');
      terminal.show();
    })
  );

  // Show Output
  context.subscriptions.push(
    vscode.commands.registerCommand('python.showOutput', () => {
      const channel = vscode.window.createOutputChannel('Python');
      const env = pythonProvider!.getActiveEnvironment();
      if (env) {
        channel.appendLine(`Python: ${env.path}`);
        channel.appendLine(`Version: ${env.version}`);
        channel.appendLine(`Venv: ${env.venvPath || 'None'}`);
      } else {
        channel.appendLine('No Python interpreter selected');
      }
      channel.show();
    })
  );

  // Clear Cache
  context.subscriptions.push(
    vscode.commands.registerCommand('python.clearCache', () => {
      pythonProvider!.clearVenvCache();
      vscode.window.showInformationMessage('Python cache cleared');
    })
  );
}

/**
 * Автодетект и активация venv
 */
async function autoDetectAndActivateVenv(): Promise<void> {
  if (!pythonProvider || !pythonConfig) return;
  if (!pythonConfig.getAutoActivateVenv()) return;

  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return;

  const venvPath = pythonConfig.getVenvPath();
  
  if (venvPath) {
    // Пытаемся активировать сохраненный venv
    try {
      await pythonProvider.activateVenv(venvPath);
      return;
    } catch {
      // Сохраненный venv недоступен, ищем новый
    }
  }

  // Автодетект venv
  const venvs = await pythonProvider.detectVenv(folders[0].uri.fsPath);
  
  if (venvs.length > 0) {
    // Активируем первый найденный venv
    const preferred = venvs.find(v => v.type === 'poetry') ||
                      venvs.find(v => v.type === 'pipenv') ||
                      venvs[0];
    
    try {
      await pythonProvider.activateVenv(preferred.path);
      await pythonConfig.setVenvPath(preferred.path);
    } catch {
      // ignore
    }
  }
}

/**
 * Маппинг severity
 */
function mapDiagnosticSeverity(severity: 'error' | 'warning' | 'info' | 'hint'): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'error':
      return vscode.DiagnosticSeverity.Error;
    case 'warning':
      return vscode.DiagnosticSeverity.Warning;
    case 'info':
      return vscode.DiagnosticSeverity.Information;
    case 'hint':
      return vscode.DiagnosticSeverity.Hint;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}

/**
 * Маппинг completion kind
 */
function mapCompletionKind(kind: string): vscode.CompletionItemKind {
  const kindMap: Record<string, vscode.CompletionItemKind> = {
    'module': vscode.CompletionItemKind.Module,
    'class': vscode.CompletionItemKind.Class,
    'function': vscode.CompletionItemKind.Function,
    'method': vscode.CompletionItemKind.Method,
    'variable': vscode.CompletionItemKind.Variable,
    'parameter': vscode.CompletionItemKind.Variable,
    'property': vscode.CompletionItemKind.Property,
    'keyword': vscode.CompletionItemKind.Keyword,
    'file': vscode.CompletionItemKind.File,
    'text': vscode.CompletionItemKind.Text,
  };
  return kindMap[kind] || vscode.CompletionItemKind.Text;
}

/**
 * Получить провайдер (для использования в других модулях)
 */
export function getPythonProvider(): PythonLanguageProvider | null {
  return pythonProvider;
}

/**
 * Получить конфигурацию (для использования в других модулях)
 */
export function getPythonConfig(): PythonConfig | null {
  return pythonConfig;
}
