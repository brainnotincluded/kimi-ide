/**
 * Go Language Provider
 * 
 * Main provider for Go language support in Kimi IDE IDE.
 * Handles compilation, testing, linting, formatting, and gopls integration.
 */

import { EventEmitter } from 'events';
import { exec, spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import {
  GoInstallation,
  GoModule,
  GoRequire,
  GoReplace,
  GoExclude,
  GoCommandResult,
  GoDiagnostic,
  GoCompletionItem,
  GoCompletionKind,
  GoBuildResult,
  GoTestResult,
  GoToolsStatus,
  GoLintTool,
  GoFormatTool,
  GoConfiguration,
  GoplsInitializeResult
} from '../types';

const execAsync = promisify(exec);

export class GoLanguageProvider extends EventEmitter {
  private installation: GoInstallation | null = null;
  private config: GoConfiguration;
  private goplsProcess: ChildProcess | null = null;
  private goplsReady = false;
  private projectRoot: string = '';
  private messageId = 0;
  private goplsCallbacks: Map<number, (result: any) => void> = new Map();

  constructor(config: Partial<GoConfiguration> = {}) {
    super();
    this.config = {
      toolsManagement: 'auto',
      lintTool: 'staticcheck',
      formatTool: 'goimports',
      buildFlags: [],
      testFlags: ['-v'],
      enableGopls: true,
      ...config
    };
  }

  /**
   * Set the project root directory
   */
  setProjectRoot(root: string): void {
    this.projectRoot = root;
  }

  /**
   * Get current configuration
   */
  getConfig(): GoConfiguration {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GoConfiguration>): void {
    this.config = { ...this.config, ...config };
    this.emit('configChanged', this.config);
  }

  /**
   * Check Go installation and environment
   */
  async checkGoInstallation(): Promise<GoInstallation> {
    try {
      // Check go version
      const { stdout: versionOutput } = await execAsync('go version');
      const versionMatch = versionOutput.match(/go version go(\d+\.\d+(?:\.\d+)?)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      // Get GOROOT
      let goroot = this.config.goroot || '';
      if (!goroot) {
        const { stdout: gorootOutput } = await execAsync('go env GOROOT');
        goroot = gorootOutput.trim();
      }

      // Get GOPATH
      let gopath = this.config.gopath || '';
      if (!gopath) {
        const { stdout: gopathOutput } = await execAsync('go env GOPATH');
        gopath = gopathOutput.trim();
      }

      // Check tool installations
      const goplsInstalled = await this.isCommandAvailable('gopls');
      const staticcheckInstalled = await this.isCommandAvailable('staticcheck');

      this.installation = {
        version,
        goroot,
        gopath,
        goplsInstalled,
        staticcheckInstalled
      };

      this.emit('installationChecked', this.installation);
      return this.installation;
    } catch (error) {
      this.installation = {
        version: 'not installed',
        goroot: '',
        gopath: '',
        goplsInstalled: false,
        staticcheckInstalled: false
      };
      this.emit('installationChecked', this.installation);
      return this.installation;
    }
  }

  /**
   * Get Go tools status
   */
  async getToolsStatus(): Promise<GoToolsStatus> {
    const [go, gopls, staticcheck, goimports, gofumpt, dlv] = await Promise.all([
      this.isCommandAvailable('go'),
      this.isCommandAvailable('gopls'),
      this.isCommandAvailable('staticcheck'),
      this.isCommandAvailable('goimports'),
      this.isCommandAvailable('gofumpt'),
      this.isCommandAvailable('dlv')
    ]);

    return { go, gopls, staticcheck, goimports, gofumpt, dlv };
  }

  /**
   * Check if a command is available
   */
  private async isCommandAvailable(cmd: string): Promise<boolean> {
    try {
      const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
      await execAsync(checkCmd);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse go.mod file
   */
  async getModulesInfo(modPath?: string): Promise<GoModule | null> {
    const goModPath = modPath || path.join(this.projectRoot, 'go.mod');
    
    if (!fs.existsSync(goModPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(goModPath, 'utf-8');
      return this.parseGoMod(content);
    } catch (error) {
      console.error('Failed to parse go.mod:', error);
      return null;
    }
  }

  /**
   * Parse go.mod content
   */
  private parseGoMod(content: string): GoModule {
    const lines = content.split('\n');
    const module: GoModule = {
      module: '',
      goVersion: '',
      require: [],
      replace: [],
      exclude: []
    };

    let inRequire = false;
    let inReplace = false;
    let inExclude = false;
    let currentBlock: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('//')) continue;

      // Module declaration
      const moduleMatch = line.match(/^module\s+(.+)$/);
      if (moduleMatch) {
        module.module = moduleMatch[1].trim().replace(/"/g, '');
        continue;
      }

      // Go version
      const goVersionMatch = line.match(/^go\s+(\d+\.\d+)$/);
      if (goVersionMatch) {
        module.goVersion = goVersionMatch[1];
        continue;
      }

      // Start of require block
      if (line === 'require (') {
        inRequire = true;
        currentBlock = [];
        continue;
      }

      // Start of replace block
      if (line === 'replace (') {
        inReplace = true;
        currentBlock = [];
        continue;
      }

      // Start of exclude block
      if (line === 'exclude (') {
        inExclude = true;
        currentBlock = [];
        continue;
      }

      // End of any block
      if (line === ')') {
        if (inRequire) {
          module.require = this.parseRequireBlock(currentBlock);
          inRequire = false;
        } else if (inReplace) {
          module.replace = this.parseReplaceBlock(currentBlock);
          inReplace = false;
        } else if (inExclude) {
          module.exclude = this.parseExcludeBlock(currentBlock);
          inExclude = false;
        }
        currentBlock = [];
        continue;
      }

      // Single-line require
      const singleRequireMatch = line.match(/^require\s+(\S+)\s+(\S+)(?:\s*\/\/\s*indirect)?$/);
      if (singleRequireMatch && !inRequire) {
        module.require.push({
          path: singleRequireMatch[1],
          version: singleRequireMatch[2],
          indirect: line.includes('indirect')
        });
        continue;
      }

      // Single-line replace
      const singleReplaceMatch = line.match(/^replace\s+(\S+)\s*=>\s*(\S+)(?:\s+(\S+))?$/);
      if (singleReplaceMatch && !inReplace) {
        module.replace.push({
          old: singleReplaceMatch[1],
          new: singleReplaceMatch[2],
          newVersion: singleReplaceMatch[3]
        });
        continue;
      }

      // Collect block content
      if (inRequire || inReplace || inExclude) {
        currentBlock.push(line);
      }
    }

    return module;
  }

  private parseRequireBlock(lines: string[]): GoRequire[] {
    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      const indirect = line.includes('indirect');
      return {
        path: parts[0]?.replace(/"/g, '') || '',
        version: parts[1]?.replace(/"/g, '') || '',
        indirect
      };
    }).filter(r => r.path);
  }

  private parseReplaceBlock(lines: string[]): GoReplace[] {
    return lines.map(line => {
      const match = line.match(/(\S+)\s*=>\s*(\S+)(?:\s+(\S+))?/);
      if (match) {
        return {
          old: match[1].replace(/"/g, ''),
          new: match[2].replace(/"/g, ''),
          newVersion: match[3]?.replace(/"/g, '')
        };
      }
      return null;
    }).filter(Boolean) as GoReplace[];
  }

  private parseExcludeBlock(lines: string[]): GoExclude[] {
    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        path: parts[0]?.replace(/"/g, '') || '',
        version: parts[1]?.replace(/"/g, '') || ''
      };
    }).filter(e => e.path);
  }

  /**
   * Run a Go command
   */
  async runGo(command: string, args: string[] = [], cwd?: string): Promise<GoCommandResult> {
    const workingDir = cwd || this.projectRoot;
    const fullCommand = `go ${command} ${args.join(' ')}`;
    
    return new Promise((resolve) => {
      const child = spawn('go', [command, ...args], {
        cwd: workingDir,
        shell: true,
        env: {
          ...process.env,
          GOROOT: this.config.goroot || process.env.GOROOT,
          GOPATH: this.config.gopath || process.env.GOPATH
        }
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
        this.emit('commandOutput', { type: 'stdout', data: data.toString() });
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
        this.emit('commandOutput', { type: 'stderr', data: data.toString() });
      });

      child.on('close', (code) => {
        const result: GoCommandResult = {
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0
        };
        this.emit('commandComplete', { command: fullCommand, result });
        resolve(result);
      });

      child.on('error', (error) => {
        const result: GoCommandResult = {
          success: false,
          stdout: '',
          stderr: error.message,
          exitCode: -1,
          error: error.message
        };
        resolve(result);
      });
    });
  }

  /**
   * Build the Go project
   */
  async build(filePath?: string, outputPath?: string): Promise<GoBuildResult> {
    const args = ['build'];
    
    if (this.config.buildFlags.length > 0) {
      args.push(...this.config.buildFlags);
    }
    
    if (outputPath) {
      args.push('-o', outputPath);
    }
    
    if (filePath) {
      args.push(filePath);
    } else {
      args.push('.');
    }

    const result = await this.runGo('build', args);
    const diagnostics = this.parseBuildErrors(result.stderr);

    return {
      success: result.success,
      binaryPath: result.success && outputPath ? outputPath : undefined,
      errors: diagnostics.filter(d => d.severity === 'error'),
      warnings: diagnostics.filter(d => d.severity === 'warning')
    };
  }

  /**
   * Run tests
   */
  async test(pattern?: string, filePath?: string): Promise<GoTestResult> {
    const args = [...this.config.testFlags];
    
    if (pattern) {
      args.push('-run', pattern);
    }
    
    if (filePath) {
      args.push(filePath);
    } else {
      args.push('./...');
    }

    const result = await this.runGo('test', args);
    return this.parseTestOutput(result.stdout, result.stderr);
  }

  /**
   * Format code using gofmt, goimports, or gofumpt
   */
  async formatCode(filePath: string): Promise<string> {
    const tool = this.config.formatTool;
    
    if (tool === 'goimports') {
      return this.runFormatter('goimports', ['-w', filePath]);
    } else if (tool === 'gofumpt') {
      return this.runFormatter('gofumpt', ['-w', filePath]);
    } else {
      return this.runFormatter('gofmt', ['-w', filePath]);
    }
  }

  /**
   * Format code content (without writing to file)
   */
  async formatCodeContent(content: string): Promise<string> {
    const tool = this.config.formatTool;
    
    return new Promise((resolve, reject) => {
      const child = spawn(tool, [], {
        cwd: this.projectRoot,
        shell: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Format failed with exit code ${code}`));
        }
      });

      child.stdin?.write(content);
      child.stdin?.end();
    });
  }

  private async runFormatter(tool: string, args: string[]): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(`${tool} ${args.join(' ')}`, {
        cwd: this.projectRoot
      });
      return stderr || stdout || 'Formatted successfully';
    } catch (error: any) {
      throw new Error(`Format failed: ${error.message}`);
    }
  }

  /**
   * Get diagnostics using go vet and lint tools
   */
  async getDiagnostics(filePath?: string): Promise<GoDiagnostic[]> {
    const diagnostics: GoDiagnostic[] = [];

    // Run go vet
    try {
      const vetResult = await this.runGo('vet', filePath ? [filePath] : ['./...']);
      if (vetResult.stderr) {
        diagnostics.push(...this.parseVetOutput(vetResult.stderr));
      }
    } catch (error) {
      console.error('go vet failed:', error);
    }

    // Run lint tool
    if (this.config.lintTool === 'staticcheck' && this.installation?.staticcheckInstalled) {
      try {
        const staticcheckResult = await this.runStaticcheck(filePath);
        diagnostics.push(...staticcheckResult);
      } catch (error) {
        console.error('staticcheck failed:', error);
      }
    }

    this.emit('diagnostics', diagnostics);
    return diagnostics;
  }

  /**
   * Run staticcheck
   */
  private async runStaticcheck(filePath?: string): Promise<GoDiagnostic[]> {
    const args = filePath ? [filePath] : ['./...'];
    
    try {
      const { stdout, stderr } = await execAsync(`staticcheck ${args.join(' ')}`, {
        cwd: this.projectRoot
      });
      return this.parseStaticcheckOutput(stdout || stderr);
    } catch (error: any) {
      // staticcheck returns non-zero when issues are found
      return this.parseStaticcheckOutput(error.stdout || error.stderr || '');
    }
  }

  /**
   * Run go mod tidy
   */
  async goModTidy(): Promise<GoCommandResult> {
    const result = await this.runGo('mod', ['tidy']);
    this.emit('modTidyComplete', result);
    return result;
  }

  /**
   * Run go mod download
   */
  async goModDownload(): Promise<GoCommandResult> {
    return this.runGo('mod', ['download']);
  }

  /**
   * Get Go completions using gopls
   */
  async getCompletions(filePath: string, line: number, column: number): Promise<GoCompletionItem[]> {
    if (!this.config.enableGopls || !this.goplsReady) {
      return this.getBasicCompletions();
    }

    return new Promise((resolve) => {
      const id = ++this.messageId;
      
      this.goplsCallbacks.set(id, (result) => {
        if (result && result.items) {
          resolve(result.items.map((item: any) => this.mapGoplsCompletion(item)));
        } else {
          resolve([]);
        }
      });

      this.sendGoplsRequest('textDocument/completion', {
        textDocument: { uri: `file://${filePath}` },
        position: { line, character: column }
      }, id);

      // Timeout fallback
      setTimeout(() => {
        this.goplsCallbacks.delete(id);
        resolve(this.getBasicCompletions());
      }, 2000);
    });
  }

  /**
   * Initialize gopls connection
   */
  async initializeGopls(): Promise<boolean> {
    if (!this.config.enableGopls) {
      return false;
    }

    if (this.goplsReady) {
      return true;
    }

    try {
      this.goplsProcess = spawn('gopls', ['-rpc.trace', '-v'], {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.goplsProcess.stdout?.on('data', (data) => {
        this.handleGoplsMessage(data.toString());
      });

      this.goplsProcess.stderr?.on('data', (data) => {
        console.log('gopls:', data.toString());
      });

      this.goplsProcess.on('close', () => {
        this.goplsReady = false;
        this.emit('goplsDisconnected');
      });

      // Initialize gopls
      await this.sendGoplsInitialize();
      
      this.goplsReady = true;
      this.emit('goplsReady');
      return true;
    } catch (error) {
      console.error('Failed to initialize gopls:', error);
      this.goplsReady = false;
      return false;
    }
  }

  /**
   * Shutdown gopls
   */
  async shutdownGopls(): Promise<void> {
    if (this.goplsProcess) {
      this.sendGoplsNotification('exit', {});
      this.goplsProcess.kill();
      this.goplsProcess = null;
      this.goplsReady = false;
    }
  }

  /**
   * Send initialize request to gopls
   */
  private async sendGoplsInitialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      
      this.goplsCallbacks.set(id, (result) => {
        if (result) {
          resolve();
        } else {
          reject(new Error('gopls initialization failed'));
        }
      });

      this.sendGoplsRequest('initialize', {
        processId: process.pid,
        rootPath: this.projectRoot,
        rootUri: `file://${this.projectRoot}`,
        capabilities: {
          textDocument: {
            completion: {
              dynamicRegistration: true,
              completionItem: {
                snippetSupport: true,
                commitCharactersSupport: true,
                documentationFormat: ['markdown', 'plaintext']
              }
            }
          }
        }
      }, id);

      setTimeout(() => {
        this.goplsCallbacks.delete(id);
        reject(new Error('gopls initialization timeout'));
      }, 10000);
    });
  }

  /**
   * Send request to gopls
   */
  private sendGoplsRequest(method: string, params: any, id: number): void {
    if (!this.goplsProcess?.stdin) return;

    const message = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params
    });

    const header = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
    this.goplsProcess.stdin.write(header + message);
  }

  /**
   * Send notification to gopls
   */
  private sendGoplsNotification(method: string, params: any): void {
    if (!this.goplsProcess?.stdin) return;

    const message = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params
    });

    const header = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
    this.goplsProcess.stdin?.write(header + message);
  }

  /**
   * Handle gopls JSON-RPC response
   */
  private handleGoplsMessage(data: string): void {
    try {
      // Parse LSP messages (handle Content-Length header)
      const lines = data.split('\r\n');
      let i = 0;
      
      while (i < lines.length) {
        if (lines[i].startsWith('Content-Length:')) {
          const length = parseInt(lines[i].split(':')[1].trim());
          i += 2; // Skip header and empty line
          
          if (i < lines.length) {
            const message = lines.slice(i).join('\r\n').substring(0, length);
            const parsed = JSON.parse(message);
            
            if (parsed.id !== undefined && this.goplsCallbacks.has(parsed.id)) {
              const callback = this.goplsCallbacks.get(parsed.id);
              this.goplsCallbacks.delete(parsed.id);
              callback?.(parsed.result);
            }
          }
        }
        i++;
      }
    } catch (error) {
      console.error('Failed to parse gopls message:', error);
    }
  }

  /**
   * Map gopls completion to our format
   */
  private mapGoplsCompletion(item: any): GoCompletionItem {
    return {
      label: item.label,
      kind: this.mapGoplsKind(item.kind),
      detail: item.detail,
      documentation: item.documentation?.value || item.documentation,
      insertText: item.insertText || item.label,
      sortText: item.sortText
    };
  }

  /**
   * Map gopls completion kinds
   */
  private mapGoplsKind(kind?: number): GoCompletionKind {
    if (!kind) return GoCompletionKind.Text;
    return kind as GoCompletionKind;
  }

  /**
   * Get basic Go completions (keywords, builtins)
   */
  private getBasicCompletions(): GoCompletionItem[] {
    const keywords = [
      'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else',
      'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface',
      'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type', 'var'
    ];

    const builtins = [
      'append', 'cap', 'close', 'complex', 'copy', 'delete', 'imag', 'len',
      'make', 'new', 'panic', 'print', 'println', 'real', 'recover'
    ];

    const types = [
      'bool', 'byte', 'complex64', 'complex128', 'error', 'float32', 'float64',
      'int', 'int8', 'int16', 'int32', 'int64', 'rune', 'string',
      'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'uintptr'
    ];

    return [
      ...keywords.map(k => ({ label: k, kind: GoCompletionKind.Keyword, insertText: k })),
      ...builtins.map(b => ({ label: b, kind: GoCompletionKind.Function, insertText: b })),
      ...types.map(t => ({ label: t, kind: GoCompletionKind.TypeParameter, insertText: t }))
    ];
  }

  /**
   * Parse build errors from go build output
   */
  private parseBuildErrors(output: string): GoDiagnostic[] {
    const diagnostics: GoDiagnostic[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Match: file:line:col: message
      const match = line.match(/^(.+):(\d+):(\d+):\s*(.+)$/);
      if (match) {
        diagnostics.push({
          file: match[1],
          line: parseInt(match[2]) - 1,
          column: parseInt(match[3]) - 1,
          severity: line.includes('error') ? 'error' : 'warning',
          message: match[4].trim(),
          source: 'go build'
        });
      }
    }

    return diagnostics;
  }

  /**
   * Parse go vet output
   */
  private parseVetOutput(output: string): GoDiagnostic[] {
    const diagnostics: GoDiagnostic[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^(.+):(\d+):(\d+):\s*(.+)$/);
      if (match) {
        diagnostics.push({
          file: match[1],
          line: parseInt(match[2]) - 1,
          column: parseInt(match[3]) - 1,
          severity: 'warning',
          message: match[4].trim(),
          source: 'go vet'
        });
      }
    }

    return diagnostics;
  }

  /**
   * Parse staticcheck output
   */
  private parseStaticcheckOutput(output: string): GoDiagnostic[] {
    const diagnostics: GoDiagnostic[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Format: file:line:col: code: message
      const match = line.match(/^(.+):(\d+):(\d+):\s*(\S+):\s*(.+)$/);
      if (match) {
        diagnostics.push({
          file: match[1],
          line: parseInt(match[2]) - 1,
          column: parseInt(match[3]) - 1,
          severity: 'warning',
          message: match[5].trim(),
          code: match[4],
          source: 'staticcheck'
        });
      }
    }

    return diagnostics;
  }

  /**
   * Parse test output
   */
  private parseTestOutput(stdout: string, stderr: string): GoTestResult {
    const output = stdout + '\n' + stderr;
    const lines = output.split('\n');
    
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const failures: GoTestResult['failures'] = [];
    
    // Parse test results
    for (const line of lines) {
      if (line.startsWith('--- PASS:')) {
        passed++;
      } else if (line.startsWith('--- FAIL:')) {
        failed++;
        const match = line.match(/--- FAIL:\s*(\S+)\s*\((.+?)\)/);
        if (match) {
          failures.push({
            test: match[1],
            package: '',
            message: 'Test failed'
          });
        }
      } else if (line.startsWith('--- SKIP:')) {
        skipped++;
      }
    }

    // Try to get duration from final summary
    const durationMatch = output.match(/\((\d+\.\d+)s\)/);
    const duration = durationMatch ? parseFloat(durationMatch[1]) * 1000 : 0;

    return {
      success: failed === 0,
      passed,
      failed,
      skipped,
      duration,
      output,
      failures
    };
  }

  /**
   * Install Go tools
   */
  async installTools(tools: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const tool of tools) {
      try {
        await execAsync(`go install ${this.getToolImportPath(tool)}@latest`, {
          env: {
            ...process.env,
            GOPATH: this.config.gopath || process.env.GOPATH
          }
        });
        results[tool] = true;
      } catch (error) {
        console.error(`Failed to install ${tool}:`, error);
        results[tool] = false;
      }
    }

    return results;
  }

  /**
   * Get tool import path
   */
  private getToolImportPath(tool: string): string {
    const paths: Record<string, string> = {
      'gopls': 'golang.org/x/tools/gopls',
      'staticcheck': 'honnef.co/go/tools/cmd/staticcheck',
      'goimports': 'golang.org/x/tools/cmd/goimports',
      'gofumpt': 'mvdan.cc/gofumpt',
      'dlv': 'github.com/go-delve/delve/cmd/dlv'
    };
    return paths[tool] || tool;
  }

  /**
   * Get environment info
   */
  async getEnvInfo(): Promise<Record<string, string>> {
    try {
      const { stdout } = await execAsync('go env -json');
      return JSON.parse(stdout);
    } catch {
      return {};
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.shutdownGopls();
    this.removeAllListeners();
  }
}
