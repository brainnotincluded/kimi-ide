import * as vscode from 'vscode';
import { CppLanguageProvider } from './CppLanguageProvider';
import { CppStatusBar } from './CppStatusBar';
import { CMakePanelManager } from './CMakePanel';
import { CppIpcHandler } from './CppIpcHandler';

/**
 * C/C++ Language Support Extension for Kimi IDE IDE
 * 
 * Features:
 * - Compiler detection (gcc, clang, cl)
 * - CMake integration
 * - Code diagnostics (clang-tidy, cppcheck)
 * - Code formatting (clang-format)
 * - Code completion (clangd LSP)
 * - Debug configuration (gdb, lldb)
 */

let cppProvider: CppLanguageProvider | undefined;
let statusBar: CppStatusBar | undefined;
let cmakePanel: CMakePanelManager | undefined;
let ipcHandler: CppIpcHandler | undefined;

/**
 * Activate C/C++ language support
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('Activating C/C++ Language Support for Kimi IDE IDE');

    // Initialize language provider
    cppProvider = new CppLanguageProvider(context);
    
    // Initialize status bar
    statusBar = new CppStatusBar(cppProvider);
    context.subscriptions.push(statusBar);

    // Initialize CMake panel
    cmakePanel = new CMakePanelManager(cppProvider, context);
    context.subscriptions.push(cmakePanel);

    // Initialize IPC handlers
    ipcHandler = new CppIpcHandler(cppProvider, context);
    context.subscriptions.push(ipcHandler);

    // Register document selectors
    registerDocumentSelectors(context);

    // Register format provider
    registerFormatProvider(context);

    // Register completion provider
    registerCompletionProvider(context);

    // Register code action provider (quick fixes)
    registerCodeActionProvider(context);

    // Register definition provider
    registerDefinitionProvider(context);

    // Auto-detect compilers on startup
    await autoDetectCompilers();

    // Register commands
    registerCommands(context);

    // Register tasks provider
    registerTasksProvider(context);

    console.log('C/C++ Language Support activated');
}

/**
 * Register document language selectors
 */
function registerDocumentSelectors(context: vscode.ExtensionContext): void {
    const cppSelector: vscode.DocumentSelector = [
        { scheme: 'file', language: 'cpp' },
        { scheme: 'file', language: 'c' },
        { scheme: 'file', language: 'cuda-cpp' },
        { scheme: 'file', pattern: '**/*.{cpp,cc,cxx,h,hpp,hxx,inl,ipp,c,C}' }
    ];

    // Set language configuration
    const cppConfig = vscode.languages.setLanguageConfiguration('cpp', {
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
        indentationRules: {
            increaseIndentPattern: /^(.*\{[^}"'`]*)$/,
            decreaseIndentPattern: /^(.*\})$/
        },
        folding: {
            markers: {
                start: /^\s*#pragma\s+region\b/,
                end: /^\s*#pragma\s+endregion\b/
            }
        },
        brackets: [
            ['{', '}'],
            ['[', ']'],
            ['(', ')'],
            ['<', '>']
        ],
        onEnterRules: [
            {
                beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
                afterText: /^\s*\*\/$/,
                action: { indentAction: vscode.IndentAction.IndentOutdent, appendText: ' * ' }
            },
            {
                beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
                action: { indentAction: vscode.IndentAction.None, appendText: ' * ' }
            },
            {
                beforeText: /(^\s*\*\s).*$/,
                action: { indentAction: vscode.IndentAction.None, appendText: '* ' }
            }
        ]
    });

    context.subscriptions.push(cppConfig);
}

/**
 * Register code format provider
 */
function registerFormatProvider(context: vscode.ExtensionContext): void {
    const cppSelector: vscode.DocumentSelector = [
        { language: 'cpp', scheme: 'file' },
        { language: 'c', scheme: 'file' }
    ];

    const formatProvider = vscode.languages.registerDocumentFormattingEditProvider(
        cppSelector,
        {
            async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
                if (!cppProvider) return [];
                return await cppProvider.formatCode(document);
            }
        }
    );

    const rangeFormatProvider = vscode.languages.registerDocumentRangeFormattingEditProvider(
        cppSelector,
        {
            async provideDocumentRangeFormattingEdits(
                document: vscode.TextDocument,
                range: vscode.Range
            ): Promise<vscode.TextEdit[]> {
                if (!cppProvider) return [];
                return await cppProvider.formatCode(document, range);
            }
        }
    );

    const onTypeFormatProvider = vscode.languages.registerOnTypeFormattingEditProvider(
        cppSelector,
        {
            async provideOnTypeFormattingEdits(
                document: vscode.TextDocument,
                position: vscode.Position,
                ch: string
            ): Promise<vscode.TextEdit[]> {
                if (!cppProvider || ch !== ';') return [];
                const line = document.lineAt(position.line);
                return await cppProvider.formatCode(document, line.range);
            }
        },
        ';', '}'
    );

    context.subscriptions.push(formatProvider, rangeFormatProvider, onTypeFormatProvider);
}

/**
 * Register completion provider
 */
function registerCompletionProvider(context: vscode.ExtensionContext): void {
    const cppSelector: vscode.DocumentSelector = [
        { language: 'cpp', scheme: 'file' },
        { language: 'c', scheme: 'file' }
    ];

    const completionProvider = vscode.languages.registerCompletionItemProvider(
        cppSelector,
        {
            async provideCompletionItems(
                document: vscode.TextDocument,
                position: vscode.Position
            ): Promise<vscode.CompletionItem[]> {
                if (!cppProvider) return [];
                return await cppProvider.getCompletions(document, position);
            }
        },
        '.', '->', '::', '#', '<', '"'
    );

    context.subscriptions.push(completionProvider);
}

/**
 * Register code action provider for quick fixes
 */
function registerCodeActionProvider(context: vscode.ExtensionContext): void {
    const cppSelector: vscode.DocumentSelector = [
        { language: 'cpp', scheme: 'file' },
        { language: 'c', scheme: 'file' }
    ];

    const codeActionProvider = vscode.languages.registerCodeActionsProvider(
        cppSelector,
        {
            provideCodeActions(
                document: vscode.TextDocument,
                range: vscode.Range | vscode.Selection,
                context: vscode.CodeActionContext
            ): vscode.CodeAction[] {
                const actions: vscode.CodeAction[] = [];

                // Add include guard action for header files
                if (document.fileName.match(/\.(h|hpp|hxx)$/i)) {
                    const includeGuardAction = new vscode.CodeAction(
                        'Add Include Guard',
                        vscode.CodeActionKind.QuickFix
                    );
                    includeGuardAction.command = {
                        command: 'cpp.addIncludeGuard',
                        title: 'Add Include Guard'
                    };
                    actions.push(includeGuardAction);
                }

                // Add header include action
                for (const diagnostic of context.diagnostics) {
                    if (diagnostic.message.includes('not found') || 
                        diagnostic.message.includes('undefined')) {
                        const addIncludeAction = new vscode.CodeAction(
                            'Add Missing Include',
                            vscode.CodeActionKind.QuickFix
                        );
                        addIncludeAction.command = {
                            command: 'cpp.addInclude',
                            title: 'Add Include'
                        };
                        actions.push(addIncludeAction);
                    }
                }

                return actions;
            }
        }
    );

    // Add include guard command
    const addIncludeGuardCmd = vscode.commands.registerCommand(
        'cpp.addIncludeGuard',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const document = editor.document;
            const filename = document.fileName.split(/[\\/]/).pop() || 'HEADER';
            const guardName = filename.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() + '_';
            const timestamp = Date.now().toString(36).toUpperCase();
            const uniqueGuard = `${guardName}${timestamp}`;

            const guardText = `#ifndef ${uniqueGuard}\n#define ${uniqueGuard}\n\n`;
            const endGuardText = `\n\n#endif // ${uniqueGuard}\n`;

            const edit = new vscode.WorkspaceEdit();
            edit.insert(document.uri, new vscode.Position(0, 0), guardText);
            edit.insert(document.uri, new vscode.Position(document.lineCount, 0), endGuardText);
            
            await vscode.workspace.applyEdit(edit);
        }
    );

    context.subscriptions.push(codeActionProvider, addIncludeGuardCmd);
}

/**
 * Register definition provider (Go to Definition)
 */
function registerDefinitionProvider(context: vscode.ExtensionContext): void {
    const cppSelector: vscode.DocumentSelector = [
        { language: 'cpp', scheme: 'file' },
        { language: 'c', scheme: 'file' }
    ];

    const definitionProvider = vscode.languages.registerDefinitionProvider(
        cppSelector,
        {
            async provideDefinition(
                document: vscode.TextDocument,
                position: vscode.Position
            ): Promise<vscode.Definition | undefined> {
                // This is a placeholder - full implementation would use clangd
                const wordRange = document.getWordRangeAtPosition(position);
                if (!wordRange) return undefined;

                const word = document.getText(wordRange);
                
                // Try to find definition in workspace
                const files = await vscode.workspace.findFiles('**/*.{cpp,c,h,hpp}', '**/build/**');
                
                for (const file of files) {
                    try {
                        const content = await vscode.workspace.fs.readFile(file);
                        const text = new TextDecoder().decode(content);
                        const lines = text.split('\n');
                        
                        for (let i = 0; i < lines.length; i++) {
                            // Simple pattern matching for function definitions
                            const pattern = new RegExp(`\\b(?:class|struct|void|int|bool|string)\\s+${word}\\s*[`);
                            if (pattern.test(lines[i]) || lines[i].includes(`${word}::`)) {
                                return new vscode.Location(file, new vscode.Position(i, 0));
                            }
                        }
                    } catch {
                        // Continue to next file
                    }
                }

                return undefined;
            }
        }
    );

    context.subscriptions.push(definitionProvider);
}

/**
 * Auto-detect compilers on startup
 */
async function autoDetectCompilers(): Promise<void> {
    if (!cppProvider) return;

    try {
        const compilers = await cppProvider.detectCompilers();
        if (compilers.length > 0) {
            console.log(`Auto-detected compilers: ${compilers.map(c => `${c.type} ${c.version}`).join(', ')}`);
            
            // Update configuration
            const config = vscode.workspace.getConfiguration('cpp');
            const currentCompiler = compilers[0];
            
            if (!config.get('compiler')) {
                await config.update('compiler', currentCompiler.type, false);
            }
        } else {
            console.warn('No C++ compilers detected');
        }
    } catch (error) {
        console.error('Failed to auto-detect compilers:', error);
    }
}

/**
 * Register additional commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
    // Show C++ status menu
    const showStatusMenuCmd = vscode.commands.registerCommand(
        'cpp.showStatusMenu',
        () => {
            if (statusBar) {
                statusBar.showStatusMenu();
            }
        }
    );

    // Quick build command
    const quickBuildCmd = vscode.commands.registerCommand(
        'cpp.quickBuild',
        async () => {
            if (!cppProvider) return;
            
            statusBar?.setBuildingStatus(true);
            try {
                const success = await cppProvider.runCMake();
                if (success) {
                    vscode.window.showInformationMessage('Build completed');
                } else {
                    vscode.window.showErrorMessage('Build failed');
                }
            } finally {
                statusBar?.setBuildingStatus(false);
            }
        }
    );

    // Quick run command
    const quickRunCmd = vscode.commands.registerCommand(
        'cpp.quickRun',
        async () => {
            await vscode.commands.executeCommand('cpp:run');
        }
    );

    // Create new C++ class
    const newClassCmd = vscode.commands.registerCommand(
        'cpp.newClass',
        async () => {
            const className = await vscode.window.showInputBox({
                prompt: 'Enter class name',
                placeHolder: 'MyClass'
            });

            if (!className) return;

            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) return;

            const headerContent = `#pragma once

namespace ${className.toLowerCase()} {

class ${className} {
public:
    ${className}();
    ~${className}();

    // Disable copy
    ${className}(const ${className}&) = delete;
    ${className}& operator=(const ${className}&) = delete;

    // Enable move
    ${className}(${className}&&) noexcept = default;
    ${className}& operator=(${className}&&) noexcept = default;

private:
};

} // namespace ${className.toLowerCase()}
`;

            const sourceContent = `#include "${className}.hpp"

namespace ${className.toLowerCase()} {

${className}::${className}() {
}

${className}::~${className}() {
}

} // namespace ${className.toLowerCase()}
`;

            const fs = await import('fs');
            const path = await import('path');

            const headerPath = path.join(workspaceRoot, 'include', `${className}.hpp`);
            const sourcePath = path.join(workspaceRoot, 'src', `${className}.cpp`);

            // Ensure directories exist
            fs.mkdirSync(path.dirname(headerPath), { recursive: true });
            fs.mkdirSync(path.dirname(sourcePath), { recursive: true });

            fs.writeFileSync(headerPath, headerContent);
            fs.writeFileSync(sourcePath, sourceContent);

            vscode.window.showInformationMessage(`Created class ${className}`);

            // Open files
            const headerDoc = await vscode.workspace.openTextDocument(headerPath);
            await vscode.window.showTextDocument(headerDoc);
        }
    );

    // Switch header/source
    const switchHeaderSourceCmd = vscode.commands.registerCommand(
        'cpp.switchHeaderSource',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const currentFile = editor.document.fileName;
            const path = await import('path');

            const ext = path.extname(currentFile).toLowerCase();
            const basename = path.basename(currentFile, ext);
            const dirname = path.dirname(currentFile);

            const headerExts = ['.h', '.hpp', '.hxx'];
            const sourceExts = ['.c', '.cpp', '.cc', '.cxx'];

            let targetExts: string[] = [];
            if (headerExts.includes(ext)) {
                targetExts = sourceExts;
            } else if (sourceExts.includes(ext)) {
                targetExts = headerExts;
            } else {
                return;
            }

            // Try to find the counterpart in same directory
            for (const targetExt of targetExts) {
                const targetPath = path.join(dirname, basename + targetExt);
                if (require('fs').existsSync(targetPath)) {
                    const doc = await vscode.workspace.openTextDocument(targetPath);
                    await vscode.window.showTextDocument(doc);
                    return;
                }
            }

            // Try common directory structures (include/src)
            const parentDir = path.dirname(dirname);
            const currentDir = path.basename(dirname);
            
            let alternativeDir: string | null = null;
            if (currentDir === 'src') {
                alternativeDir = path.join(parentDir, 'include');
            } else if (currentDir === 'include') {
                alternativeDir = path.join(parentDir, 'src');
            }

            if (alternativeDir) {
                for (const targetExt of targetExts) {
                    const targetPath = path.join(alternativeDir, basename + targetExt);
                    if (require('fs').existsSync(targetPath)) {
                        const doc = await vscode.workspace.openTextDocument(targetPath);
                        await vscode.window.showTextDocument(doc);
                        return;
                    }
                }
            }

            vscode.window.showInformationMessage('Counterpart file not found');
        }
    );

    context.subscriptions.push(
        showStatusMenuCmd,
        quickBuildCmd,
        quickRunCmd,
        newClassCmd,
        switchHeaderSourceCmd
    );
}

/**
 * Register tasks provider for C++ build tasks
 */
function registerTasksProvider(context: vscode.ExtensionContext): void {
    const taskProvider = vscode.tasks.registerTaskProvider('cpp', {
        provideTasks(): vscode.Task[] {
            const tasks: vscode.Task[] = [];
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0];
            
            if (!workspaceRoot) return tasks;

            // Configure task
            const configureTask = new vscode.Task(
                { type: 'cpp', task: 'configure' },
                workspaceRoot,
                'Configure',
                'cpp',
                new vscode.ShellExecution('cmake', ['..'], { cwd: '${workspaceFolder}/build' })
            );
            configureTask.group = vscode.TaskGroup.Build;
            tasks.push(configureTask);

            // Build task
            const buildTask = new vscode.Task(
                { type: 'cpp', task: 'build' },
                workspaceRoot,
                'Build',
                'cpp',
                new vscode.ShellExecution('cmake', ['--build', '.'], { cwd: '${workspaceFolder}/build' })
            );
            buildTask.group = vscode.TaskGroup.Build;
            tasks.push(buildTask);

            // Clean task
            const cleanTask = new vscode.Task(
                { type: 'cpp', task: 'clean' },
                workspaceRoot,
                'Clean',
                'cpp',
                new vscode.ShellExecution('cmake', ['--build', '.', '--target', 'clean'], { cwd: '${workspaceFolder}/build' })
            );
            cleanTask.group = vscode.TaskGroup.Clean;
            tasks.push(cleanTask);

            return tasks;
        },
        resolveTask(task: vscode.Task): vscode.Task | undefined {
            return task;
        }
    });

    context.subscriptions.push(taskProvider);
}

/**
 * Deactivate C/C++ language support
 */
export function deactivate(): void {
    console.log('Deactivating C/C++ Language Support');

    cppProvider?.dispose();
    cppProvider = undefined;

    statusBar = undefined;
    cmakePanel = undefined;
    ipcHandler = undefined;
}
