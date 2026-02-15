import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

export interface CompilerInfo {
    name: string;
    path: string;
    version: string;
    type: 'gcc' | 'clang' | 'cl';
}

export interface CMakeTarget {
    name: string;
    type: 'EXECUTABLE' | 'STATIC_LIBRARY' | 'SHARED_LIBRARY' | 'OBJECT_LIBRARY';
    sourceFiles: string[];
}

export interface CMakeInfo {
    hasCMake: boolean;
    projectName?: string;
    version?: string;
    targets: CMakeTarget[];
    buildDirectory: string;
}

export interface CppDiagnostic {
    file: string;
    line: number;
    column: number;
    severity: 'error' | 'warning' | 'info';
    message: string;
    code?: string;
    source: string;
}

export interface DebugConfiguration {
    type: 'gdb' | 'lldb';
    program: string;
    args: string[];
    cwd: string;
    env: { [key: string]: string };
    preLaunchTask?: string;
}

export class CppLanguageProvider extends EventEmitter {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private clangdClient: any | null = null;
    private currentCompiler: CompilerInfo | null = null;
    private cmakeInfo: CMakeInfo | null = null;

    constructor(context: vscode.ExtensionContext) {
        super();
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('C/C++');
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('cpp');
    }

    /**
     * Detect available C++ compilers (gcc, clang, cl)
     */
    async detectCompilers(): Promise<CompilerInfo[]> {
        const compilers: CompilerInfo[] = [];
        const detectedPaths = new Set<string>();

        // Detection commands for each compiler
        const detectionCommands = [
            { type: 'gcc' as const, commands: ['gcc', 'g++', 'gcc-13', 'gcc-12', 'gcc-11', 'g++-13', 'g++-12', 'g++-11'] },
            { type: 'clang' as const, commands: ['clang', 'clang++', 'clang-17', 'clang-16', 'clang-15', 'clang++-17', 'clang++-16', 'clang++-15'] },
            { type: 'cl' as const, commands: ['cl', 'cl.exe'] }
        ];

        for (const { type, commands } of detectionCommands) {
            for (const cmd of commands) {
                try {
                    const versionCmd = type === 'cl' ? `${cmd} 2>&1` : `${cmd} --version`;
                    const { stdout } = await execAsync(versionCmd, { timeout: 5000 });
                    
                    // Check if already detected
                    const cmdPath = await this.getCommandPath(cmd);
                    if (detectedPaths.has(cmdPath)) continue;
                    detectedPaths.add(cmdPath);

                    const version = this.parseVersion(stdout, type);
                    const compilerInfo: CompilerInfo = {
                        name: cmd,
                        path: cmdPath,
                        version,
                        type
                    };
                    compilers.push(compilerInfo);
                } catch (e) {
                    // Command not found
                }
            }
        }

        // Sort by preference: clang > gcc > cl
        compilers.sort((a, b) => {
            const order = { clang: 0, gcc: 1, cl: 2 };
            return order[a.type] - order[b.type];
        });

        if (compilers.length > 0) {
            this.currentCompiler = compilers[0];
        }

        this.emit('compilersDetected', compilers);
        return compilers;
    }

    private async getCommandPath(cmd: string): Promise<string> {
        try {
            if (process.platform === 'win32') {
                const { stdout } = await execAsync(`where ${cmd}`, { timeout: 5000 });
                return stdout.trim().split('\n')[0].trim();
            } else {
                const { stdout } = await execAsync(`which ${cmd}`, { timeout: 5000 });
                return stdout.trim();
            }
        } catch {
            return cmd;
        }
    }

    private parseVersion(output: string, type: 'gcc' | 'clang' | 'cl'): string {
        const lines = output.split('\n');
        
        if (type === 'gcc') {
            const match = lines[0]?.match(/\d+\.\d+\.\d+/);
            return match ? match[0] : 'unknown';
        } else if (type === 'clang') {
            const match = lines[0]?.match(/\d+\.\d+\.\d+/);
            return match ? match[0] : 'unknown';
        } else if (type === 'cl') {
            // MSVC version parsing
            const match = output.match(/Version\s+(\d+\.\d+)/);
            return match ? match[1] : 'unknown';
        }
        
        return 'unknown';
    }

    /**
     * Parse CMakeLists.txt and extract project information
     */
    async getCMakeInfo(workspaceRoot?: string): Promise<CMakeInfo | null> {
        const root = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) return null;

        const cmakeFile = path.join(root, 'CMakeLists.txt');
        if (!fs.existsSync(cmakeFile)) {
            this.cmakeInfo = { hasCMake: false, targets: [], buildDirectory: this.getBuildDirectory() };
            return this.cmakeInfo;
        }

        const content = fs.readFileSync(cmakeFile, 'utf-8');
        
        // Parse project name
        const projectMatch = content.match(/project\s*\(\s*(\w+)/i);
        const projectName = projectMatch ? projectMatch[1] : undefined;

        // Parse version
        const versionMatch = content.match(/VERSION\s+(\d+\.\d+(?:\.\d+)?)/i);
        const version = versionMatch ? versionMatch[1] : undefined;

        // Parse targets (simple regex-based parsing)
        const targets: CMakeTarget[] = [];
        
        // Executable targets
        const exeMatches = content.matchAll(/add_executable\s*\(\s*(\w+)([^)]*)\)/gi);
        for (const match of exeMatches) {
            const targetName = match[1];
            const sources = this.extractSourceFiles(match[2], content);
            targets.push({ name: targetName, type: 'EXECUTABLE', sourceFiles: sources });
        }

        // Library targets
        const libMatches = content.matchAll(/add_library\s*\(\s*(\w+)\s+(STATIC|SHARED)?\s*([^)]*)\)/gi);
        for (const match of libMatches) {
            const targetName = match[1];
            const libType = (match[2]?.toUpperCase() || 'STATIC') as CMakeTarget['type'];
            const sources = this.extractSourceFiles(match[3], content);
            targets.push({ 
                name: targetName, 
                type: libType === 'STATIC' ? 'STATIC_LIBRARY' : libType === 'SHARED' ? 'SHARED_LIBRARY' : 'STATIC_LIBRARY', 
                sourceFiles: sources 
            });
        }

        this.cmakeInfo = {
            hasCMake: true,
            projectName,
            version,
            targets,
            buildDirectory: this.getBuildDirectory()
        };

        return this.cmakeInfo;
    }

    private extractSourceFiles(targetContent: string, fullContent: string): string[] {
        const files: string[] = [];
        const fileMatches = targetContent.matchAll(/([\w./-]+\.(?:cpp|c|cc|cxx|h|hpp))/gi);
        for (const match of fileMatches) {
            files.push(match[1]);
        }
        return files;
    }

    private getBuildDirectory(): string {
        const config = vscode.workspace.getConfiguration('cpp');
        return config.get<string>('buildDirectory') || 'build';
    }

    /**
     * Configure and build CMake project
     */
    async configureCMake(): Promise<boolean> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return false;

        if (!this.cmakeInfo?.hasCMake) {
            vscode.window.showWarningMessage('No CMakeLists.txt found in workspace');
            return false;
        }

        const buildDir = path.join(workspaceRoot, this.getBuildDirectory());
        
        // Create build directory if needed
        if (!fs.existsSync(buildDir)) {
            fs.mkdirSync(buildDir, { recursive: true });
        }

        this.outputChannel.show();
        this.outputChannel.appendLine(`Configuring CMake in ${buildDir}...`);

        const config = vscode.workspace.getConfiguration('cpp');
        const standard = config.get<string>('standard') || 'c++17';
        const compiler = this.currentCompiler?.path || 'g++';

        const cmakeArgs = [
            '..',
            `-DCMAKE_CXX_STANDARD=${standard.replace('c++', '')}`,
            `-DCMAKE_CXX_COMPILER=${compiler}`
        ];

        // Add include paths
        const includePaths = config.get<string[]>('includePaths') || [];
        if (includePaths.length > 0) {
            cmakeArgs.push(`-DCMAKE_CXX_FLAGS="${includePaths.map(p => `-I${p}`).join(' ')}"`);
        }

        // Add defines
        const defines = config.get<Record<string, string>>('defines') || {};
        const defineFlags = Object.entries(defines).map(([k, v]) => `-D${k}=${v}`);
        if (defineFlags.length > 0) {
            cmakeArgs.push(`-DCMAKE_CXX_FLAGS="${defineFlags.join(' ')}"`);
        }

        return new Promise((resolve) => {
            const cmake = spawn('cmake', cmakeArgs, { 
                cwd: buildDir,
                shell: true
            });

            cmake.stdout.on('data', (data) => {
                this.outputChannel.append(data.toString());
            });

            cmake.stderr.on('data', (data) => {
                this.outputChannel.append(data.toString());
            });

            cmake.on('close', (code) => {
                if (code === 0) {
                    this.outputChannel.appendLine('CMake configuration completed successfully');
                    this.emit('cmakeConfigured');
                    resolve(true);
                } else {
                    this.outputChannel.appendLine(`CMake configuration failed with code ${code}`);
                    resolve(false);
                }
            });
        });
    }

    /**
     * Build CMake target
     */
    async runCMake(target?: string): Promise<boolean> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return false;

        const buildDir = path.join(workspaceRoot, this.getBuildDirectory());
        if (!fs.existsSync(buildDir)) {
            const configured = await this.configureCMake();
            if (!configured) return false;
        }

        this.outputChannel.show();
        this.outputChannel.appendLine(`Building${target ? ` target: ${target}` : '...'}`);

        const buildArgs = ['--build', '.'];
        if (target) {
            buildArgs.push('--target', target);
        }
        
        // Add parallel build
        const config = vscode.workspace.getConfiguration('cpp');
        const parallelJobs = config.get<number>('parallelJobs') || 0;
        if (parallelJobs > 0) {
            buildArgs.push('-j', parallelJobs.toString());
        } else {
            buildArgs.push('-j', require('os').cpus().length.toString());
        }

        return new Promise((resolve) => {
            const cmake = spawn('cmake', buildArgs, { 
                cwd: buildDir,
                shell: true
            });

            cmake.stdout.on('data', (data) => {
                this.outputChannel.append(data.toString());
            });

            cmake.stderr.on('data', (data) => {
                this.outputChannel.append(data.toString());
            });

            cmake.on('close', (code) => {
                if (code === 0) {
                    this.outputChannel.appendLine('Build completed successfully');
                    this.emit('buildComplete', target);
                    resolve(true);
                } else {
                    this.outputChannel.appendLine(`Build failed with code ${code}`);
                    resolve(false);
                }
            });
        });
    }

    /**
     * Get diagnostics using clang-tidy and cppcheck
     */
    async getDiagnostics(filePath?: string): Promise<CppDiagnostic[]> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return [];

        const diagnostics: CppDiagnostic[] = [];
        const targetFile = filePath || '${file}';

        // Run clang-tidy
        try {
            const clangTidyOutput = await this.runClangTidy(targetFile, workspaceRoot);
            diagnostics.push(...this.parseClangTidyOutput(clangTidyOutput));
        } catch (e) {
            // clang-tidy not available
        }

        // Run cppcheck
        try {
            const cppcheckOutput = await this.runCppcheck(targetFile, workspaceRoot);
            diagnostics.push(...this.parseCppcheckOutput(cppcheckOutput));
        } catch (e) {
            // cppcheck not available
        }

        // Update VS Code diagnostics
        this.updateDiagnosticCollection(diagnostics);
        
        return diagnostics;
    }

    private async runClangTidy(filePath: string, cwd: string): Promise<string> {
        const config = vscode.workspace.getConfiguration('cpp');
        const checks = config.get<string>('clangTidyChecks') || 
            'cppcoreguidelines-*,modernize-*,performance-*,portability-*,readability-*';
        
        const buildDir = path.join(cwd, this.getBuildDirectory());
        const compileCommandsPath = path.join(buildDir, 'compile_commands.json');
        
        const args = [`-checks=${checks}`];
        if (fs.existsSync(compileCommandsPath)) {
            args.push(`-p=${buildDir}`);
        }
        args.push(filePath);

        const { stdout } = await execAsync(`clang-tidy ${args.join(' ')}`, { 
            cwd,
            timeout: 60000,
            encoding: 'utf-8'
        });
        
        return stdout;
    }

    private parseClangTidyOutput(output: string): CppDiagnostic[] {
        const diagnostics: CppDiagnostic[] = [];
        const lines = output.split('\n');
        
        for (const line of lines) {
            // Parse: /path/to/file.cpp:10:5: warning: message [check-name]
            const match = line.match(/^(.+):(\d+):(\d+):\s*(error|warning|note):\s*(.+?)\s*\[([^\]]+)\]$/);
            if (match) {
                diagnostics.push({
                    file: match[1],
                    line: parseInt(match[2], 10),
                    column: parseInt(match[3], 10),
                    severity: match[4] === 'error' ? 'error' : match[4] === 'warning' ? 'warning' : 'info',
                    message: match[5],
                    code: match[6],
                    source: 'clang-tidy'
                });
            }
        }
        
        return diagnostics;
    }

    private async runCppcheck(filePath: string, cwd: string): Promise<string> {
        const config = vscode.workspace.getConfiguration('cpp');
        const enableChecks = config.get<string>('cppcheckEnable') || 'all';
        const standard = config.get<string>('standard') || 'c++17';
        
        const args = [
            '--enable=' + enableChecks,
            '--std=' + standard,
            '--template={file}:{line}:{column}:{severity}:{message}:{id}',
            '--quiet'
        ];
        
        // Add include paths
        const includePaths = config.get<string[]>('includePaths') || [];
        for (const inc of includePaths) {
            args.push('-I', inc);
        }
        
        args.push(filePath);

        const { stdout } = await execAsync(`cppcheck ${args.join(' ')}`, { 
            cwd,
            timeout: 60000,
            encoding: 'utf-8'
        });
        
        return stdout;
    }

    private parseCppcheckOutput(output: string): CppDiagnostic[] {
        const diagnostics: CppDiagnostic[] = [];
        const lines = output.split('\n');
        
        for (const line of lines) {
            // Parse: file:line:column:severity:message:id
            const parts = line.split(':');
            if (parts.length >= 5) {
                const severity = parts[3].toLowerCase();
                diagnostics.push({
                    file: parts[0],
                    line: parseInt(parts[1], 10) || 1,
                    column: parseInt(parts[2], 10) || 1,
                    severity: severity === 'error' ? 'error' : 
                              severity === 'warning' ? 'warning' : 'info',
                    message: parts.slice(4, -1).join(':'),
                    code: parts[parts.length - 1],
                    source: 'cppcheck'
                });
            }
        }
        
        return diagnostics;
    }

    private updateDiagnosticCollection(diagnostics: CppDiagnostic[]): void {
        const diagnosticMap = new Map<string, vscode.Diagnostic[]>();

        for (const d of diagnostics) {
            const uri = vscode.Uri.file(d.file);
            const range = new vscode.Range(d.line - 1, d.column - 1, d.line - 1, d.column - 1);
            const severity = d.severity === 'error' ? vscode.DiagnosticSeverity.Error :
                            d.severity === 'warning' ? vscode.DiagnosticSeverity.Warning :
                            vscode.DiagnosticSeverity.Information;
            
            const diagnostic = new vscode.Diagnostic(range, `[${d.source}] ${d.message}`, severity);
            diagnostic.code = d.code;
            diagnostic.source = d.source;

            if (!diagnosticMap.has(uri.toString())) {
                diagnosticMap.set(uri.toString(), []);
            }
            diagnosticMap.get(uri.toString())!.push(diagnostic);
        }

        this.diagnosticCollection.clear();
        for (const [uri, diags] of diagnosticMap) {
            this.diagnosticCollection.set(vscode.Uri.parse(uri), diags);
        }
    }

    /**
     * Format code using clang-format
     */
    async formatCode(document: vscode.TextDocument, range?: vscode.Range): Promise<vscode.TextEdit[]> {
        const config = vscode.workspace.getConfiguration('cpp');
        const style = config.get<string>('clangFormatStyle') || 'file';
        
        const filePath = document.uri.fsPath;
        const content = document.getText(range);
        
        try {
            const args = [`-style=${style}`, '-assume-filename=' + filePath];
            
            const { stdout } = await execAsync(`clang-format ${args.join(' ')}`, {
                input: content,
                timeout: 30000,
                encoding: 'utf-8'
            });

            const fullRange = range || new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );

            return [vscode.TextEdit.replace(fullRange, stdout)];
        } catch (e) {
            vscode.window.showErrorMessage(`clang-format failed: ${e}`);
            return [];
        }
    }

    /**
     * Get code completions using clangd LSP
     */
    async getCompletions(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[]> {
        // This is a placeholder - actual clangd integration would use
        // the Language Client library to communicate with clangd
        if (!this.clangdClient) {
            await this.startClangd();
        }

        // For now, return basic completions
        const completions: vscode.CompletionItem[] = [];
        
        // Common C++ keywords
        const keywords = [
            'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand', 'bitor',
            'bool', 'break', 'case', 'catch', 'char', 'char8_t', 'char16_t', 'char32_t',
            'class', 'compl', 'concept', 'const', 'consteval', 'constexpr', 'constinit',
            'const_cast', 'continue', 'co_await', 'co_return', 'co_yield', 'decltype',
            'default', 'delete', 'do', 'double', 'dynamic_cast', 'else', 'enum',
            'explicit', 'export', 'extern', 'false', 'float', 'for', 'friend', 'goto',
            'if', 'inline', 'int', 'long', 'mutable', 'namespace', 'new', 'noexcept',
            'not', 'not_eq', 'nullptr', 'operator', 'or', 'or_eq', 'private', 'protected',
            'public', 'register', 'reinterpret_cast', 'requires', 'return', 'short',
            'signed', 'sizeof', 'static', 'static_assert', 'static_cast', 'struct',
            'switch', 'template', 'this', 'thread_local', 'throw', 'true', 'try',
            'typedef', 'typeid', 'typename', 'union', 'unsigned', 'using', 'virtual',
            'void', 'volatile', 'wchar_t', 'while', 'xor', 'xor_eq'
        ];

        for (const keyword of keywords) {
            const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
            item.detail = 'C++ Keyword';
            completions.push(item);
        }

        // Common snippets
        const snippets = [
            { label: 'for', insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:count}; ++${1:i}) {\n\t$0\n}' },
            { label: 'forr', insertText: 'for (auto& ${1:item} : ${2:container}) {\n\t$0\n}' },
            { label: 'if', insertText: 'if (${1:condition}) {\n\t$0\n}' },
            { label: 'class', insertText: 'class ${1:Name} {\npublic:\n\t${1:Name}();\n\t~${1:Name}();\n\nprivate:\n\t$0\n};' },
            { label: 'namespace', insertText: 'namespace ${1:name} {\n\t$0\n} // namespace ${1:name}' },
            { label: 'main', insertText: 'int main(int argc, char* argv[]) {\n\t$0\n\treturn 0;\n}' },
            { label: 'cout', insertText: 'std::cout << ${1:message} << std::endl;' },
            { label: 'cin', insertText: 'std::cin >> ${1:variable};' },
            { label: 'vector', insertText: 'std::vector<${1:T}> ${2:name};' },
            { label: 'map', insertText: 'std::map<${1:K}, ${2:V}> ${3:name};' },
            { label: 'unique_ptr', insertText: 'std::unique_ptr<${1:T}> ${2:name};' },
            { label: 'shared_ptr', insertText: 'std::shared_ptr<${1:T}> ${2:name};' }
        ];

        for (const snippet of snippets) {
            const item = new vscode.CompletionItem(snippet.label, vscode.CompletionItemKind.Snippet);
            item.insertText = new vscode.SnippetString(snippet.insertText);
            completions.push(item);
        }

        return completions;
    }

    private async startClangd(): Promise<void> {
        const config = vscode.workspace.getConfiguration('cpp');
        const clangdPath = config.get<string>('clangdPath') || 'clangd';
        
        const args = [
            '--background-index',
            '--clang-tidy',
            '--header-insertion=iwyu',
            '--completion-style=bundled',
            '--pch-storage=memory',
            '--cross-file-rename'
        ];

        // Build directory for compile_commands.json
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
            const buildDir = path.join(workspaceRoot, this.getBuildDirectory());
            if (fs.existsSync(path.join(buildDir, 'compile_commands.json'))) {
                args.push(`--compile-commands-dir=${buildDir}`);
            }
        }

        // Note: Full LSP client integration would require vscode-languageclient
        // This is a simplified placeholder
        this.clangdClient = { path: clangdPath, args };
    }

    /**
     * Create debug configuration for gdb/lldb
     */
    async debugConfiguration(targetName?: string): Promise<DebugConfiguration | null> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return null;

        const config = vscode.workspace.getConfiguration('cpp');
        const debuggerType = config.get<'gdb' | 'lldb'>('debugger') || 'gdb';

        // Determine the executable path
        let program = '';
        
        if (this.cmakeInfo?.hasCMake && targetName) {
            const target = this.cmakeInfo.targets.find(t => t.name === targetName && t.type === 'EXECUTABLE');
            if (target) {
                program = path.join(workspaceRoot, this.getBuildDirectory(), targetName);
                if (process.platform === 'win32') {
                    program += '.exe';
                }
            }
        }

        if (!program) {
            // Try to find an executable in the build directory
            const buildDir = path.join(workspaceRoot, this.getBuildDirectory());
            if (fs.existsSync(buildDir)) {
                const files = fs.readdirSync(buildDir);
                for (const file of files) {
                    const filePath = path.join(buildDir, file);
                    const stat = fs.statSync(filePath);
                    if (stat.isFile() && (stat.mode & 0o111)) {
                        program = filePath;
                        break;
                    }
                }
            }
        }

        if (!program) {
            vscode.window.showWarningMessage('Could not find executable to debug');
            return null;
        }

        const debugConfig: DebugConfiguration = {
            type: debuggerType,
            program,
            args: config.get<string[]>('debugArgs') || [],
            cwd: workspaceRoot,
            env: config.get<Record<string, string>>('debugEnv') || {},
            preLaunchTask: 'cpp: build'
        };

        // Generate launch.json entry
        const launchConfig = {
            type: process.platform === 'darwin' ? 'lldb' : 'cppdbg',
            request: 'launch',
            name: `Debug ${targetName || 'C++'}`,
            program: debugConfig.program,
            args: debugConfig.args,
            stopAtEntry: false,
            cwd: debugConfig.cwd,
            environment: Object.entries(debugConfig.env).map(([name, value]) => ({ name, value })),
            externalConsole: false,
            MIMode: debuggerType,
            preLaunchTask: debugConfig.preLaunchTask
        };

        // Offer to update launch.json
        this.updateLaunchJson(launchConfig);

        return debugConfig;
    }

    private async updateLaunchJson(configuration: any): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return;

        const vscodeDir = path.join(workspaceRoot, '.vscode');
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }

        const launchPath = path.join(vscodeDir, 'launch.json');
        let launchConfig: { version: string; configurations: any[] } = { version: '0.2.0', configurations: [] };

        if (fs.existsSync(launchPath)) {
            try {
                launchConfig = JSON.parse(fs.readFileSync(launchPath, 'utf-8'));
            } catch (e) {
                // Invalid JSON, start fresh
            }
        }

        // Check if configuration already exists
        const existingIndex = launchConfig.configurations.findIndex(
            c => c.name === configuration.name
        );

        if (existingIndex >= 0) {
            launchConfig.configurations[existingIndex] = configuration;
        } else {
            launchConfig.configurations.push(configuration);
        }

        fs.writeFileSync(launchPath, JSON.stringify(launchConfig, null, 4));
    }

    /**
     * Get current compiler info
     */
    getCurrentCompiler(): CompilerInfo | null {
        return this.currentCompiler;
    }

    /**
     * Set active compiler
     */
    setCompiler(compiler: CompilerInfo): void {
        this.currentCompiler = compiler;
        this.emit('compilerChanged', compiler);
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.outputChannel.dispose();
        this.diagnosticCollection.dispose();
        this.removeAllListeners();
    }
}
