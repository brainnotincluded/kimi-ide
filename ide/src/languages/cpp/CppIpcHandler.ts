import * as vscode from 'vscode';
import { CppLanguageProvider, CompilerInfo, CMakeInfo, CppDiagnostic, DebugConfiguration } from './CppLanguageProvider';

/**
 * IPC Handler for C/C++ language support
 * Handles all IPC channels for cpp:* commands
 */
export class CppIpcHandler {
    private provider: CppLanguageProvider;
    private disposables: vscode.Disposable[] = [];

    constructor(provider: CppLanguageProvider, context: vscode.ExtensionContext) {
        this.provider = provider;
        this.registerIpcHandlers(context);
    }

    /**
     * Register all IPC handlers for cpp:* channels
     */
    private registerIpcHandlers(context: vscode.ExtensionContext): void {
        // cpp:detectCompilers - Detect available C++ compilers
        const detectCompilersHandler = vscode.commands.registerCommand(
            'cpp:detectCompilers',
            async (): Promise<CompilerInfo[]> => {
                try {
                    const compilers = await this.provider.detectCompilers();
                    vscode.window.showInformationMessage(
                        `Detected ${compilers.length} compiler(s): ${compilers.map(c => c.type).join(', ')}`
                    );
                    return compilers;
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to detect compilers: ${error}`);
                    return [];
                }
            }
        );

        // cpp:configureCMake - Configure CMake project
        const configureCMakeHandler = vscode.commands.registerCommand(
            'cpp:configureCMake',
            async (): Promise<{ success: boolean; message: string }> => {
                try {
                    const success = await this.provider.configureCMake();
                    if (success) {
                        return { success: true, message: 'CMake configured successfully' };
                    } else {
                        return { success: false, message: 'CMake configuration failed' };
                    }
                } catch (error) {
                    const message = `CMake configuration error: ${error}`;
                    vscode.window.showErrorMessage(message);
                    return { success: false, message };
                }
            }
        );

        // cpp:build - Build CMake target
        const buildHandler = vscode.commands.registerCommand(
            'cpp:build',
            async (target?: string): Promise<{ success: boolean; message: string; target?: string }> => {
                try {
                    const success = await this.provider.runCMake(target);
                    if (success) {
                        const message = target 
                            ? `Target "${target}" built successfully`
                            : 'Build completed successfully';
                        return { success: true, message, target };
                    } else {
                        return { success: false, message: 'Build failed', target };
                    }
                } catch (error) {
                    const message = `Build error: ${error}`;
                    vscode.window.showErrorMessage(message);
                    return { success: false, message, target };
                }
            }
        );

        // cpp:buildAll - Build all targets
        const buildAllHandler = vscode.commands.registerCommand(
            'cpp:buildAll',
            async (): Promise<{ success: boolean; message: string }> => {
                return vscode.commands.executeCommand('cpp:build', undefined);
            }
        );

        // cpp:clean - Clean build directory
        const cleanHandler = vscode.commands.registerCommand(
            'cpp:clean',
            async (): Promise<{ success: boolean; message: string }> => {
                try {
                    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                    if (!workspaceRoot) {
                        return { success: false, message: 'No workspace folder open' };
                    }

                    const cmakeInfo = await this.provider.getCMakeInfo();
                    const buildDir = cmakeInfo?.buildDirectory || 'build';
                    const buildPath = `${workspaceRoot}/${buildDir}`;

                    const fs = await import('fs');
                    const path = await import('path');

                    if (fs.existsSync(buildPath)) {
                        // Use cmake --build . --target clean if available
                        try {
                            const { exec } = await import('child_process');
                            const { promisify } = await import('util');
                            const execAsync = promisify(exec);
                            
                            await execAsync('cmake --build . --target clean', {
                                cwd: buildPath,
                                timeout: 30000
                            });
                        } catch {
                            // Fallback: remove build directory contents
                            const files = fs.readdirSync(buildPath);
                            for (const file of files) {
                                const filePath = path.join(buildPath, file);
                                fs.rmSync(filePath, { recursive: true, force: true });
                            }
                        }
                    }

                    return { success: true, message: 'Build directory cleaned' };
                } catch (error) {
                    const message = `Clean error: ${error}`;
                    return { success: false, message };
                }
            }
        );

        // cpp:run - Run executable
        const runHandler = vscode.commands.registerCommand(
            'cpp:run',
            async (executablePath?: string, args: string[] = []): Promise<{ success: boolean; message: string }> => {
                try {
                    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                    if (!workspaceRoot) {
                        return { success: false, message: 'No workspace folder open' };
                    }

                    let program = executablePath;
                    if (!program) {
                        // Try to find executable in build directory
                        const cmakeInfo = await this.provider.getCMakeInfo();
                        if (cmakeInfo?.targets.length) {
                            const executableTarget = cmakeInfo.targets.find(t => t.type === 'EXECUTABLE');
                            if (executableTarget) {
                                const buildDir = cmakeInfo.buildDirectory || 'build';
                                const ext = process.platform === 'win32' ? '.exe' : '';
                                program = `${workspaceRoot}/${buildDir}/${executableTarget.name}${ext}`;
                            }
                        }
                    }

                    if (!program) {
                        return { success: false, message: 'No executable specified or found' };
                    }

                    // Create or reuse terminal
                    let terminal = vscode.window.terminals.find(t => t.name === 'C++ Run');
                    if (!terminal) {
                        terminal = vscode.window.createTerminal('C++ Run');
                    }
                    terminal.show();

                    const argString = args.length > 0 ? ' ' + args.join(' ') : '';
                    terminal.sendText(`"${program}"${argString}`);

                    return { success: true, message: `Running: ${program}` };
                } catch (error) {
                    const message = `Run error: ${error}`;
                    return { success: false, message };
                }
            }
        );

        // cpp:debug - Start debugging session
        const debugHandler = vscode.commands.registerCommand(
            'cpp:debug',
            async (targetName?: string): Promise<{ success: boolean; message: string }> => {
                try {
                    const debugConfig = await this.provider.debugConfiguration(targetName);
                    if (!debugConfig) {
                        return { success: false, message: 'Failed to create debug configuration' };
                    }

                    // Start debugging
                    const started = await vscode.debug.startDebugging(undefined, {
                        type: process.platform === 'darwin' ? 'lldb' : 'cppdbg',
                        request: 'launch',
                        name: `Debug ${targetName || 'C++'}`,
                        program: debugConfig.program,
                        args: debugConfig.args,
                        stopAtEntry: false,
                        cwd: debugConfig.cwd,
                        environment: Object.entries(debugConfig.env).map(([name, value]) => ({ name, value })),
                        externalConsole: false,
                        MIMode: debugConfig.type
                    });

                    if (started) {
                        return { success: true, message: 'Debug session started' };
                    } else {
                        return { success: false, message: 'Failed to start debug session' };
                    }
                } catch (error) {
                    const message = `Debug error: ${error}`;
                    return { success: false, message };
                }
            }
        );

        // cpp:getDiagnostics - Get code diagnostics
        const getDiagnosticsHandler = vscode.commands.registerCommand(
            'cpp:getDiagnostics',
            async (filePath?: string): Promise<{ success: boolean; diagnostics: CppDiagnostic[]; message: string }> => {
                try {
                    const diagnostics = await this.provider.getDiagnostics(filePath);
                    const errorCount = diagnostics.filter(d => d.severity === 'error').length;
                    const warningCount = diagnostics.filter(d => d.severity === 'warning').length;
                    
                    const message = `Found ${errorCount} error(s) and ${warningCount} warning(s)`;
                    vscode.window.setStatusBarMessage(message, 5000);
                    
                    return { success: true, diagnostics, message };
                } catch (error) {
                    const message = `Diagnostics error: ${error}`;
                    return { success: false, diagnostics: [], message };
                }
            }
        );

        // cpp:format - Format code
        const formatHandler = vscode.commands.registerCommand(
            'cpp:format',
            async (): Promise<{ success: boolean; message: string }> => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        return { success: false, message: 'No active editor' };
                    }

                    const document = editor.document;
                    if (document.languageId !== 'cpp' && document.languageId !== 'c') {
                        return { success: false, message: 'Not a C/C++ file' };
                    }

                    const edits = await this.provider.formatCode(document);
                    if (edits.length > 0) {
                        const workspaceEdit = new vscode.WorkspaceEdit();
                        workspaceEdit.set(document.uri, edits);
                        await vscode.workspace.applyEdit(workspaceEdit);
                        await document.save();
                    }

                    return { success: true, message: 'Code formatted' };
                } catch (error) {
                    const message = `Format error: ${error}`;
                    return { success: false, message };
                }
            }
        );

        // cpp:getCMakeInfo - Get CMake project info
        const getCMakeInfoHandler = vscode.commands.registerCommand(
            'cpp:getCMakeInfo',
            async (): Promise<{ success: boolean; info: CMakeInfo | null; message: string }> => {
                try {
                    const info = await this.provider.getCMakeInfo();
                    if (info?.hasCMake) {
                        return { 
                            success: true, 
                            info, 
                            message: `CMake project: ${info.projectName || 'unnamed'}` 
                        };
                    } else {
                        return { success: false, info: null, message: 'No CMakeLists.txt found' };
                    }
                } catch (error) {
                    const message = `CMake info error: ${error}`;
                    return { success: false, info: null, message };
                }
            }
        );

        // cpp:setCompiler - Set active compiler
        const setCompilerHandler = vscode.commands.registerCommand(
            'cpp:setCompiler',
            async (compilerType?: 'gcc' | 'clang' | 'cl'): Promise<{ success: boolean; message: string }> => {
                try {
                    const compilers = await this.provider.detectCompilers();
                    
                    let selected: CompilerInfo | undefined;
                    
                    if (compilerType) {
                        selected = compilers.find(c => c.type === compilerType);
                    }

                    if (!selected) {
                        // Show picker
                        const items = compilers.map(c => ({
                            label: `${c.type.toUpperCase()} ${c.version}`,
                            description: c.path,
                            compiler: c
                        }));

                        const picked = await vscode.window.showQuickPick(items, {
                            placeHolder: 'Select compiler'
                        });

                        if (!picked) {
                            return { success: false, message: 'No compiler selected' };
                        }

                        selected = picked.compiler;
                    }

                    this.provider.setCompiler(selected);
                    await vscode.workspace.getConfiguration('cpp').update('compiler', selected.type, true);

                    return { success: true, message: `Compiler set to ${selected.name} (${selected.version})` };
                } catch (error) {
                    const message = `Set compiler error: ${error}`;
                    return { success: false, message };
                }
            }
        );

        // cpp:getCompletions - Get code completions
        const getCompletionsHandler = vscode.commands.registerCommand(
            'cpp:getCompletions',
            async (document?: vscode.TextDocument, position?: vscode.Position): Promise<{ success: boolean; completions: vscode.CompletionItem[]; message: string }> => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor && (!document || !position)) {
                        return { success: false, completions: [], message: 'No active editor' };
                    }

                    const doc = document || editor!.document;
                    const pos = position || editor!.selection.active;

                    const completions = await this.provider.getCompletions(doc, pos);
                    return { success: true, completions, message: `Found ${completions.length} completions` };
                } catch (error) {
                    const message = `Completions error: ${error}`;
                    return { success: false, completions: [], message };
                }
            }
        );

        // Add all handlers to subscriptions
        context.subscriptions.push(
            detectCompilersHandler,
            configureCMakeHandler,
            buildHandler,
            buildAllHandler,
            cleanHandler,
            runHandler,
            debugHandler,
            getDiagnosticsHandler,
            formatHandler,
            getCMakeInfoHandler,
            setCompilerHandler,
            getCompletionsHandler
        );
    }

    /**
     * Dispose all IPC handlers
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}
