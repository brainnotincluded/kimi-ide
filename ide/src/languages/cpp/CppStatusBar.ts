import * as vscode from 'vscode';
import { CppLanguageProvider, CompilerInfo } from './CppLanguageProvider';

export class CppStatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private provider: CppLanguageProvider;
    private disposables: vscode.Disposable[] = [];

    constructor(provider: CppLanguageProvider) {
        this.provider = provider;
        
        // Create status bar item (left side, high priority)
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        
        this.setupEventHandlers();
        this.updateDisplay();
        this.statusBarItem.show();
    }

    private setupEventHandlers(): void {
        // Listen for compiler changes
        this.provider.on('compilerChanged', () => {
            this.updateDisplay();
        });

        // Listen for build events
        this.provider.on('buildComplete', () => {
            this.updateDisplay();
        });

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('cpp')) {
                this.updateDisplay();
            }
        }, null, this.disposables);

        // Click handler - show quick pick menu
        this.statusBarItem.command = 'cpp.showStatusMenu';
    }

    private updateDisplay(): void {
        const compiler = this.provider.getCurrentCompiler();
        const config = vscode.workspace.getConfiguration('cpp');
        const standard = config.get<string>('standard') || 'c++17';

        if (compiler) {
            // Format: [GCC 11.2] [C++17] | Build Icon
            const compilerShort = this.getCompilerShortName(compiler.type);
            const versionShort = compiler.version.split('.').slice(0, 2).join('.');
            
            this.statusBarItem.text = `$(tools) ${compilerShort} ${versionShort} | ${standard}`;
            this.statusBarItem.tooltip = [
                `Compiler: ${compiler.name} (${compiler.version})`,
                `Path: ${compiler.path}`,
                `Standard: ${standard}`,
                '',
                'Click to change settings or build'
            ].join('\n');
        } else {
            this.statusBarItem.text = `$(tools) No Compiler | ${standard}`;
            this.statusBarItem.tooltip = 'No C++ compiler detected. Click to detect compilers.';
        }
    }

    private getCompilerShortName(type: string): string {
        switch (type) {
            case 'gcc': return 'GCC';
            case 'clang': return 'Clang';
            case 'cl': return 'MSVC';
            default: return type.toUpperCase();
        }
    }

    /**
     * Show the status menu (compiler selection, standard selection, build)
     */
    async showStatusMenu(): Promise<void> {
        const compiler = this.provider.getCurrentCompiler();
        const config = vscode.workspace.getConfiguration('cpp');
        const standard = config.get<string>('standard') || 'c++17';

        const items: vscode.QuickPickItem[] = [
            {
                label: '$(gear) Change Compiler',
                description: compiler ? `Current: ${compiler.name}` : 'No compiler selected',
                detail: 'Select a different C++ compiler'
            },
            {
                label: '$(symbol-numeric) Change C++ Standard',
                description: `Current: ${standard}`,
                detail: 'Select C++ standard (c++11, c++14, c++17, c++20)'
            },
            { label: '', kind: vscode.QuickPickItemKind.Separator },
            {
                label: '$(play) Build Project',
                description: 'cmake --build',
                detail: 'Build the current CMake project'
            },
            {
                label: '$(tools) Configure CMake',
                description: 'cmake ..',
                detail: 'Configure CMake project'
            },
            {
                label: '$(debug-start) Build & Debug',
                description: 'Build and start debugging',
                detail: 'Build project and launch debugger'
            },
            { label: '', kind: vscode.QuickPickItemKind.Separator },
            {
                label: '$(run) Run Executable',
                description: 'Run the built executable',
                detail: 'Run the last built target'
            },
            {
                label: '$(refresh) Refresh Compilers',
                description: 'Re-detect available compilers',
                detail: 'Scan system for available C++ compilers'
            }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select C++ action',
            title: 'C/C++ Language Support'
        });

        if (!selected) return;

        switch (selected.label) {
            case '$(gear) Change Compiler':
                await this.changeCompiler();
                break;
            case '$(symbol-numeric) Change C++ Standard':
                await this.changeStandard();
                break;
            case '$(play) Build Project':
                await this.provider.runCMake();
                break;
            case '$(tools) Configure CMake':
                await this.provider.configureCMake();
                break;
            case '$(debug-start) Build & Debug':
                await this.buildAndDebug();
                break;
            case '$(run) Run Executable':
                await this.runExecutable();
                break;
            case '$(refresh) Refresh Compilers':
                await this.refreshCompilers();
                break;
        }
    }

    private async changeCompiler(): Promise<void> {
        const compilers = await this.provider.detectCompilers();
        
        if (compilers.length === 0) {
            vscode.window.showWarningMessage('No C++ compilers found on this system');
            return;
        }

        const items = compilers.map(c => ({
            label: `${c.type.toUpperCase()} ${c.version}`,
            description: c.path,
            detail: `Type: ${c.type}`,
            compiler: c
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select compiler'
        });

        if (selected) {
            this.provider.setCompiler(selected.compiler);
            await vscode.workspace.getConfiguration('cpp').update('compiler', selected.compiler.type, true);
            vscode.window.showInformationMessage(`Selected compiler: ${selected.label}`);
        }
    }

    private async changeStandard(): Promise<void> {
        const standards = ['c++11', 'c++14', 'c++17', 'c++20', 'c++23'];
        const config = vscode.workspace.getConfiguration('cpp');
        const current = config.get<string>('standard') || 'c++17';

        const items = standards.map(s => ({
            label: s,
            description: s === current ? '(current)' : ''
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select C++ standard'
        });

        if (selected) {
            await config.update('standard', selected.label, true);
            vscode.window.showInformationMessage(`C++ standard set to ${selected.label}`);
        }
    }

    private async buildAndDebug(): Promise<void> {
        const success = await this.provider.runCMake();
        if (success) {
            await this.provider.debugConfiguration();
            // Start debugging session
            vscode.debug.startDebugging(undefined, {
                type: process.platform === 'darwin' ? 'lldb' : 'cppdbg',
                request: 'launch',
                name: 'Debug C++',
                program: '${workspaceFolder}/build/main',
                args: [],
                stopAtEntry: false,
                cwd: '${workspaceFolder}',
                environment: [],
                externalConsole: false,
                MIMode: process.platform === 'darwin' ? 'lldb' : 'gdb'
            });
        }
    }

    private async runExecutable(): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return;

        const buildDir = `${workspaceRoot}/build`;
        
        // Find executables in build directory
        const fs = await import('fs');
        const path = await import('path');
        
        if (!fs.existsSync(buildDir)) {
            vscode.window.showErrorMessage('Build directory not found. Build the project first.');
            return;
        }

        const files = fs.readdirSync(buildDir);
        const executables: string[] = [];

        for (const file of files) {
            const filePath = path.join(buildDir, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                // Check if executable (Unix) or .exe (Windows)
                if (process.platform === 'win32' ? file.endsWith('.exe') : (stat.mode & 0o111)) {
                    executables.push(filePath);
                }
            }
        }

        if (executables.length === 0) {
            vscode.window.showErrorMessage('No executable found in build directory');
            return;
        }

        const selected = executables.length === 1 ? executables[0] : 
            await vscode.window.showQuickPick(executables.map(e => ({
                label: path.basename(e),
                fullPath: e
            })), { placeHolder: 'Select executable to run' }).then(i => i?.fullPath);

        if (selected) {
            const terminal = vscode.window.createTerminal('C++ Run');
            terminal.show();
            terminal.sendText(selected);
        }
    }

    private async refreshCompilers(): Promise<void> {
        const compilers = await this.provider.detectCompilers();
        vscode.window.showInformationMessage(`Found ${compilers.length} compiler(s)`);
    }

    /**
     * Update build status (building/in progress/done)
     */
    setBuildingStatus(isBuilding: boolean): void {
        if (isBuilding) {
            this.statusBarItem.text = '$(sync~spin) Building...';
            this.statusBarItem.tooltip = 'Build in progress...';
        } else {
            this.updateDisplay();
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.statusBarItem.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
