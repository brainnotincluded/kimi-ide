/**
 * Code Tree Builder
 * 
 * Строит дерево codebase используя TypeScript Compiler API.
 * Извлекает классы, функции, интерфейсы, типы, экспорты и импорты.
 * Поддерживает инкрементальные обновления и кеширование.
 */

import * as ts from 'typescript';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';

// ==================== Types ====================

export type SymbolKind = 
  | 'class' 
  | 'interface' 
  | 'type' 
  | 'enum' 
  | 'function' 
  | 'method' 
  | 'property' 
  | 'variable' 
  | 'export' 
  | 'import';

export interface CodeSymbol {
  id: string;
  name: string;
  kind: SymbolKind;
  filePath: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  parent?: string;
  children: string[];
  modifiers: string[];
  jsDoc?: string;
  signature?: string;
  isExported: boolean;
  isDefaultExport: boolean;
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  defaultImport?: string;
  namespaceImport?: string;
  line: number;
  isTypeOnly: boolean;
}

export interface ExportInfo {
  name: string;
  localName?: string;
  isDefault: boolean;
  isReexport: boolean;
  source?: string;
  line: number;
}

export interface FileNode {
  path: string;
  symbols: Map<string, CodeSymbol>;
  imports: ImportInfo[];
  exports: ExportInfo[];
  dependencies: Set<string>; // file paths this file depends on
  dependents: Set<string>; // file paths that depend on this file
  lastModified: number;
  summary?: string;
  language: string;
  size: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'export' | 'inheritance' | 'implementation';
  symbols: string[];
}

export interface CodeTree {
  files: Map<string, FileNode>;
  symbols: Map<string, CodeSymbol>;
  dependencies: DependencyEdge[];
  rootPath: string;
  lastFullScan: number;
}

export interface TreeBuilderOptions {
  cacheDir?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number; // bytes
  enableJsDoc?: boolean;
  followSymlinks?: boolean;
}

// ==================== CodeTreeBuilder Class ====================

export class CodeTreeBuilder extends EventEmitter {
  private tree: CodeTree;
  private options: Required<TreeBuilderOptions>;
  private compilerHost: ts.CompilerHost;
  private program?: ts.Program;
  private fileWatcher?: vscode.FileSystemWatcher;
  private isBuilding = false;
  private pendingUpdates = new Set<string>();
  private updateTimeout?: NodeJS.Timeout;
  private cacheFilePath: string;

  // Default options
  private static readonly DEFAULT_OPTIONS: Required<TreeBuilderOptions> = {
    cacheDir: '.kimi/cache',
    includePatterns: ['**/*.{ts,tsx,js,jsx}'],
    excludePatterns: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}'
    ],
    maxFileSize: 1024 * 1024, // 1MB
    enableJsDoc: true,
    followSymlinks: false
  };

  constructor(options: TreeBuilderOptions = {}) {
    super();
    this.options = { ...CodeTreeBuilder.DEFAULT_OPTIONS, ...options };
    this.tree = this.createEmptyTree();
    this.cacheFilePath = path.join(this.options.cacheDir, 'code-tree-cache.json');
    this.compilerHost = this.createCompilerHost();
  }

  // ==================== Public API ====================

  /**
   * Initialize the tree builder - load from cache or build fresh
   */
  async initialize(): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    this.tree.rootPath = workspaceRoot;

    // Try to load from cache first
    const cached = await this.loadFromCache();
    if (cached) {
      this.emit('loaded-from-cache', { fileCount: cached.files.size });
      // Schedule incremental update to catch changes since last run
      this.scheduleIncrementalUpdate();
    } else {
      await this.fullRebuild();
    }

    // Setup file watchers
    this.setupFileWatchers();
  }

  /**
   * Perform a full rebuild of the code tree
   */
  async fullRebuild(): Promise<void> {
    if (this.isBuilding) {
      throw new Error('Build already in progress');
    }

    this.isBuilding = true;
    this.emit('build-started');

    try {
      const startTime = Date.now();
      this.tree = this.createEmptyTree();
      this.tree.rootPath = this.getWorkspaceRoot();

      // Find all files
      const files = await this.findSourceFiles();
      
      // Create TypeScript program
      this.program = ts.createProgram(files, this.getCompilerOptions(), this.compilerHost);

      // Build tree for each file
      for (const filePath of files) {
        await this.processFile(filePath);
      }

      // Build dependency graph
      this.buildDependencyGraph();

      this.tree.lastFullScan = Date.now();

      // Save to cache
      await this.saveToCache();

      const duration = Date.now() - startTime;
      this.emit('build-completed', { 
        duration, 
        files: files.length, 
        symbols: this.tree.symbols.size 
      });
    } finally {
      this.isBuilding = false;
    }
  }

  /**
   * Update a single file in the tree (incremental)
   */
  async updateFile(filePath: string): Promise<void> {
    if (!this.shouldProcessFile(filePath)) {
      return;
    }

    this.pendingUpdates.add(filePath);
    this.scheduleIncrementalUpdate();
  }

  /**
   * Remove a file from the tree
   */
  removeFile(filePath: string): void {
    const normalizedPath = path.normalize(filePath);
    const fileNode = this.tree.files.get(normalizedPath);
    
    if (fileNode) {
      // Remove all symbols from this file
      for (const symbolId of fileNode.symbols.keys()) {
        this.tree.symbols.delete(symbolId);
      }
      
      // Update dependencies
      for (const dep of fileNode.dependencies) {
        const depFile = this.tree.files.get(dep);
        if (depFile) {
          depFile.dependents.delete(normalizedPath);
        }
      }
      
      // Remove from tree
      this.tree.files.delete(normalizedPath);
      
      // Rebuild dependency edges
      this.rebuildDependencyEdges();
      
      this.emit('file-removed', { path: normalizedPath });
    }
  }

  /**
   * Get the current code tree
   */
  getTree(): Readonly<CodeTree> {
    return this.tree;
  }

  /**
   * Get file node by path
   */
  getFile(filePath: string): FileNode | undefined {
    return this.tree.files.get(path.normalize(filePath));
  }

  /**
   * Get symbol by ID
   */
  getSymbol(symbolId: string): CodeSymbol | undefined {
    return this.tree.symbols.get(symbolId);
  }

  /**
   * Find symbols by name
   */
  findSymbolsByName(name: string): CodeSymbol[] {
    const results: CodeSymbol[] = [];
    for (const symbol of this.tree.symbols.values()) {
      if (symbol.name === name) {
        results.push(symbol);
      }
    }
    return results;
  }

  /**
   * Get all files that depend on the given file
   */
  getDependents(filePath: string): string[] {
    const normalizedPath = path.normalize(filePath);
    const fileNode = this.tree.files.get(normalizedPath);
    return fileNode ? Array.from(fileNode.dependents) : [];
  }

  /**
   * Get all files that the given file depends on
   */
  getDependencies(filePath: string): string[] {
    const normalizedPath = path.normalize(filePath);
    const fileNode = this.tree.files.get(normalizedPath);
    return fileNode ? Array.from(fileNode.dependencies) : [];
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.fileWatcher?.dispose();
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.removeAllListeners();
  }

  // ==================== Private Methods ====================

  private createEmptyTree(): CodeTree {
    return {
      files: new Map(),
      symbols: new Map(),
      dependencies: [],
      rootPath: '',
      lastFullScan: 0
    };
  }

  private getWorkspaceRoot(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open');
    }
    return workspaceFolders[0].uri.fsPath;
  }

  private createCompilerHost(): ts.CompilerHost {
    const host = ts.createCompilerHost(this.getCompilerOptions());
    const originalGetSourceFile = host.getSourceFile;
    
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
      // Normalize file paths
      const normalizedPath = path.normalize(fileName);
      return originalGetSourceFile.call(host, normalizedPath, languageVersion, onError, shouldCreateNewSourceFile);
    };

    return host;
  }

  private getCompilerOptions(): ts.CompilerOptions {
    return {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      esModuleInterop: true,
      skipLibCheck: true,
      strict: false,
      jsx: ts.JsxEmit.React,
      allowJs: true,
      checkJs: false,
      noEmit: true
    };
  }

  private async findSourceFiles(): Promise<string[]> {
    const files: string[] = [];
    
    for (const pattern of this.options.includePatterns) {
      const uris = await vscode.workspace.findFiles(
        pattern,
        `{${this.options.excludePatterns.join(',')}}`
      );
      
      for (const uri of uris) {
        const stat = await fs.promises.stat(uri.fsPath).catch(() => null);
        if (stat && stat.size <= this.options.maxFileSize) {
          files.push(uri.fsPath);
        }
      }
    }
    
    return [...new Set(files)]; // Remove duplicates
  }

  private shouldProcessFile(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    const relativePath = path.relative(this.tree.rootPath, normalizedPath);
    
    // Check exclude patterns
    for (const pattern of this.options.excludePatterns) {
      if (this.matchGlob(relativePath, pattern)) {
        return false;
      }
    }
    
    // Check include patterns
    for (const pattern of this.options.includePatterns) {
      if (this.matchGlob(relativePath, pattern)) {
        return true;
      }
    }
    
    return false;
  }

  private matchGlob(filePath: string, pattern: string): boolean {
    // Simple glob matching - could be enhanced with minimatch library
    const regex = new RegExp(
      '^' + 
      pattern
        .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<<DOUBLESTAR>>>/g, '.*')
        .replace(/\?/g, '.')
        .replace(/\/\*\*\//g, '(/|/.*/)')
      + '$'
    );
    return regex.test(filePath);
  }

  private async processFile(filePath: string): Promise<void> {
    const normalizedPath = path.normalize(filePath);
    const sourceFile = this.program?.getSourceFile(normalizedPath);
    
    if (!sourceFile) {
      return;
    }

    const stat = await fs.promises.stat(normalizedPath).catch(() => null);
    const fileNode: FileNode = {
      path: normalizedPath,
      symbols: new Map(),
      imports: [],
      exports: [],
      dependencies: new Set(),
      dependents: new Set(),
      lastModified: stat?.mtimeMs || Date.now(),
      language: this.detectLanguage(normalizedPath),
      size: stat?.size || 0
    };

    // Process AST
    this.processNode(sourceFile, fileNode, sourceFile);

    this.tree.files.set(normalizedPath, fileNode);
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.ts': return 'typescript';
      case '.tsx': return 'typescriptreact';
      case '.js': return 'javascript';
      case '.jsx': return 'javascriptreact';
      default: return 'unknown';
    }
  }

  private processNode(node: ts.Node, fileNode: FileNode, sourceFile: ts.SourceFile, parentSymbolId?: string): void {
    const symbol = this.extractSymbol(node, fileNode, sourceFile);
    
    if (symbol) {
      fileNode.symbols.set(symbol.id, symbol);
      this.tree.symbols.set(symbol.id, symbol);
      
      if (parentSymbolId) {
        symbol.parent = parentSymbolId;
        const parent = this.tree.symbols.get(parentSymbolId);
        if (parent) {
          parent.children.push(symbol.id);
        }
      }
    }

    // Process imports
    if (ts.isImportDeclaration(node)) {
      const importInfo = this.extractImport(node, sourceFile);
      if (importInfo) {
        fileNode.imports.push(importInfo);
      }
    }

    // Process exports
    if (ts.isExportDeclaration(node) || 
        (ts.canHaveModifiers(node) && this.hasExportModifier(node))) {
      const exportInfo = this.extractExport(node, sourceFile);
      if (exportInfo) {
        fileNode.exports.push(exportInfo);
      }
    }

    // Process children
    ts.forEachChild(node, child => {
      this.processNode(child, fileNode, sourceFile, symbol?.id);
    });
  }

  private extractSymbol(node: ts.Node, fileNode: FileNode, sourceFile: ts.SourceFile): CodeSymbol | null {
    let kind: SymbolKind | null = null;
    let name: string | null = null;
    let signature: string | undefined;

    // Determine symbol kind and name
    if (ts.isClassDeclaration(node)) {
      kind = 'class';
      name = node.name?.text || '<anonymous>';
    } else if (ts.isInterfaceDeclaration(node)) {
      kind = 'interface';
      name = node.name.text;
    } else if (ts.isTypeAliasDeclaration(node)) {
      kind = 'type';
      name = node.name.text;
    } else if (ts.isEnumDeclaration(node)) {
      kind = 'enum';
      name = node.name.text;
    } else if (ts.isFunctionDeclaration(node)) {
      kind = 'function';
      name = node.name?.text || '<anonymous>';
      signature = this.extractFunctionSignature(node, sourceFile);
    } else if (ts.isMethodDeclaration(node)) {
      kind = 'method';
      name = node.name.getText(sourceFile);
      signature = this.extractFunctionSignature(node, sourceFile);
    } else if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
      kind = 'property';
      name = node.name.getText(sourceFile);
    } else if (ts.isVariableDeclaration(node)) {
      kind = 'variable';
      name = node.name.getText(sourceFile);
    } else {
      return null;
    }

    const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    const { line: endLine, character: endCharacter } = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());
    
    const symbolId = `${fileNode.path}#${name}@${line}:${character}`;
    const modifiers = this.getModifiers(node);

    return {
      id: symbolId,
      name,
      kind,
      filePath: fileNode.path,
      line: line + 1,
      column: character + 1,
      endLine: endLine + 1,
      endColumn: endCharacter + 1,
      children: [],
      modifiers,
      jsDoc: this.options.enableJsDoc ? this.extractJsDoc(node) : undefined,
      signature,
      isExported: modifiers.includes('export'),
      isDefaultExport: this.isDefaultExport(node)
    };
  }

  private extractFunctionSignature(node: ts.FunctionDeclaration | ts.MethodDeclaration, sourceFile: ts.SourceFile): string {
    const params = node.parameters.map(p => {
      const name = p.name.getText(sourceFile);
      const type = p.type ? `: ${p.type.getText(sourceFile)}` : '';
      return `${name}${type}`;
    }).join(', ');

    const returnType = node.type ? `: ${node.type.getText(sourceFile)}` : '';
    return `(${params})${returnType}`;
  }

  private getModifiers(node: ts.Node): string[] {
    const modifiers: string[] = [];
    const nodeModifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    
    if (nodeModifiers) {
      for (const mod of nodeModifiers) {
        modifiers.push(ts.SyntaxKind[mod.kind].toLowerCase());
      }
    }
    
    return modifiers;
  }

  private hasExportModifier(node: ts.Node): boolean {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    return modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;
  }

  private isDefaultExport(node: ts.Node): boolean {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    return modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword) || false;
  }

  private extractJsDoc(node: ts.Node): string | undefined {
    const jsDoc = ts.getJSDocCommentsAndTags(node);
    if (jsDoc && jsDoc.length > 0) {
      return jsDoc.map(doc => doc.getText()).join('\n');
    }
    return undefined;
  }

  private extractImport(node: ts.ImportDeclaration, sourceFile: ts.SourceFile): ImportInfo | null {
    const source = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
    const { line } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    
    const specifiers: string[] = [];
    let defaultImport: string | undefined;
    let namespaceImport: string | undefined;

    if (node.importClause) {
      // Default import
      if (node.importClause.name) {
        defaultImport = node.importClause.name.text;
      }

      // Named imports
      if (node.importClause.namedBindings) {
        if (ts.isNamedImports(node.importClause.namedBindings)) {
          for (const element of node.importClause.namedBindings.elements) {
            specifiers.push(element.name.text);
          }
        } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          namespaceImport = node.importClause.namedBindings.name.text;
        }
      }
    }

    return {
      source,
      specifiers,
      defaultImport,
      namespaceImport,
      line: line + 1,
      isTypeOnly: node.importClause?.isTypeOnly || false
    };
  }

  private extractExport(node: ts.Node, sourceFile: ts.SourceFile): ExportInfo | null {
    const { line } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());

    if (ts.isExportDeclaration(node)) {
      // Re-export from another module
      if (node.moduleSpecifier) {
        const source = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
        
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          // Named re-exports
          const elements = node.exportClause.elements;
          if (elements.length > 0) {
            return {
              name: elements[0].name.text,
              localName: elements[0].propertyName?.text,
              isDefault: false,
              isReexport: true,
              source,
              line: line + 1
            };
          }
        }
      }
      return null;
    }

    // Direct export
    let name: string | undefined;
    let isDefault = this.isDefaultExport(node);

    if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
      name = node.name?.text;
    } else if (ts.isVariableStatement(node)) {
      name = node.declarationList.declarations[0]?.name.getText(sourceFile);
    } else if (ts.isEnumDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      name = node.name.text;
    }

    if (name) {
      return {
        name,
        isDefault,
        isReexport: false,
        line: line + 1
      };
    }

    return null;
  }

  private buildDependencyGraph(): void {
    // Clear existing edges
    this.tree.dependencies = [];

    // Build edges from imports
    for (const [filePath, fileNode] of this.tree.files) {
      for (const importInfo of fileNode.imports) {
        const resolvedPath = this.resolveImport(filePath, importInfo.source);
        if (resolvedPath && this.tree.files.has(resolvedPath)) {
          fileNode.dependencies.add(resolvedPath);
          const depFile = this.tree.files.get(resolvedPath);
          if (depFile) {
            depFile.dependents.add(filePath);
          }

          this.tree.dependencies.push({
            from: filePath,
            to: resolvedPath,
            type: 'import',
            symbols: importInfo.specifiers
          });
        }
      }
    }
  }

  private resolveImport(fromFile: string, importPath: string): string | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const resolved = path.resolve(path.dirname(fromFile), importPath);
      
      // Try different extensions
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
      for (const ext of extensions) {
        const fullPath = resolved + ext;
        if (this.tree.files.has(fullPath)) {
          return fullPath;
        }
      }
    }
    
    // TODO: Handle node_modules imports
    return null;
  }

  private rebuildDependencyEdges(): void {
    this.tree.dependencies = this.tree.dependencies.filter(
      edge => this.tree.files.has(edge.from) && this.tree.files.has(edge.to)
    );
  }

  private setupFileWatchers(): void {
    const pattern = new vscode.RelativePattern(
      this.tree.rootPath,
      `{${this.options.includePatterns.join(',')}}`
    );

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      pattern,
      false, // ignoreCreateEvents
      false, // ignoreChangeEvents  
      false  // ignoreDeleteEvents
    );

    this.fileWatcher.onDidCreate(uri => this.updateFile(uri.fsPath));
    this.fileWatcher.onDidChange(uri => this.updateFile(uri.fsPath));
    this.fileWatcher.onDidDelete(uri => this.removeFile(uri.fsPath));
  }

  private scheduleIncrementalUpdate(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(() => {
      this.processPendingUpdates();
    }, 500); // Debounce for 500ms
  }

  private async processPendingUpdates(): Promise<void> {
    if (this.pendingUpdates.size === 0 || this.isBuilding) {
      return;
    }

    this.isBuilding = true;
    this.emit('incremental-update-started');

    const filesToUpdate = Array.from(this.pendingUpdates);
    this.pendingUpdates.clear();

    try {
      // Update program if needed
      const allFiles = Array.from(this.tree.files.keys()).concat(filesToUpdate);
      this.program = ts.createProgram(allFiles, this.getCompilerOptions(), this.compilerHost);

      for (const filePath of filesToUpdate) {
        // Remove old data
        this.removeFile(filePath);
        
        // Process updated file
        if (fs.existsSync(filePath)) {
          await this.processFile(filePath);
        }
      }

      // Rebuild dependency graph
      this.buildDependencyGraph();

      // Save to cache
      await this.saveToCache();

      this.emit('incremental-update-completed', { updatedFiles: filesToUpdate.length });
    } finally {
      this.isBuilding = false;
      
      // Check if new updates came in while processing
      if (this.pendingUpdates.size > 0) {
        this.scheduleIncrementalUpdate();
      }
    }
  }

  private async loadFromCache(): Promise<CodeTree | null> {
    try {
      if (!fs.existsSync(this.cacheFilePath)) {
        return null;
      }

      const data = await fs.promises.readFile(this.cacheFilePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Validate cache structure
      if (!parsed.files || !parsed.symbols || !parsed.rootPath) {
        return null;
      }

      // Convert plain objects back to Maps and Sets
      const tree: CodeTree = {
        files: new Map(),
        symbols: new Map(Object.entries(parsed.symbols)),
        dependencies: parsed.dependencies || [],
        rootPath: parsed.rootPath,
        lastFullScan: parsed.lastFullScan || 0
      };

      for (const [key, value] of Object.entries(parsed.files)) {
        const fileNode = value as FileNode;
        tree.files.set(key, {
          ...fileNode,
          symbols: new Map(Object.entries(fileNode.symbols)),
          dependencies: new Set(fileNode.dependencies),
          dependents: new Set(fileNode.dependents)
        });
      }

      return tree;
    } catch {
      return null;
    }
  }

  private async saveToCache(): Promise<void> {
    try {
      // Ensure cache directory exists
      await fs.promises.mkdir(this.options.cacheDir, { recursive: true });

      // Convert Maps and Sets to plain objects for serialization
      const serializable = {
        files: Object.fromEntries(
          Array.from(this.tree.files.entries()).map(([key, fileNode]) => [
            key,
            {
              ...fileNode,
              symbols: Object.fromEntries(fileNode.symbols),
              dependencies: Array.from(fileNode.dependencies),
              dependents: Array.from(fileNode.dependents)
            }
          ])
        ),
        symbols: Object.fromEntries(this.tree.symbols),
        dependencies: this.tree.dependencies,
        rootPath: this.tree.rootPath,
        lastFullScan: this.tree.lastFullScan
      };

      await fs.promises.writeFile(
        this.cacheFilePath,
        JSON.stringify(serializable, null, 2),
        'utf-8'
      );
    } catch (error) {
      this.emit('cache-error', { error });
    }
  }
}
