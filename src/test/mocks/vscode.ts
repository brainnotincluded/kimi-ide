/**
 * VS Code API Mocks for testing
 * Mock implementation of vscode module for unit tests
 */

import { EventEmitter } from 'events';

// ============================================================================
// Basic Types
// ============================================================================

export enum SymbolKind {
    File = 0,
    Module = 1,
    Namespace = 2,
    Package = 3,
    Class = 4,
    Method = 5,
    Property = 6,
    Field = 7,
    Constructor = 8,
    Enum = 9,
    Interface = 10,
    Function = 11,
    Variable = 12,
    Constant = 13,
    String = 14,
    Number = 15,
    Boolean = 16,
    Array = 17,
    Object = 18,
    Key = 19,
    Null = 20,
    EnumMember = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25,
}

export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64,
}

// ============================================================================
// Uri
// ============================================================================

export class Uri {
    scheme: string;
    authority: string;
    path: string;
    query: string;
    fragment: string;

    constructor(scheme: string, authority: string, path: string, query: string, fragment: string) {
        this.scheme = scheme;
        this.authority = authority;
        this.path = path;
        this.query = query;
        this.fragment = fragment;
    }

    get fsPath(): string {
        return this.path;
    }

    static file(path: string): Uri {
        return new Uri('file', '', path, '', '');
    }

    static parse(value: string): Uri {
        const match = value.match(/^(\w+):\/\/([^/]*)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/);
        if (match) {
            return new Uri(match[1], match[2], match[3] || '', '', '');
        }
        return Uri.file(value);
    }

    static joinPath(base: Uri, ...pathSegments: string[]): Uri {
        const joinedPath = [base.path, ...pathSegments].join('/').replace(/\/+/g, '/');
        return new Uri(base.scheme, base.authority, joinedPath, base.query, base.fragment);
    }

    toString(): string {
        return `${this.scheme}://${this.authority}${this.path}`;
    }

    toJSON(): any {
        return {
            scheme: this.scheme,
            authority: this.authority,
            path: this.path,
            query: this.query,
            fragment: this.fragment,
            fsPath: this.fsPath
        };
    }

    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
        return new Uri(
            change.scheme ?? this.scheme,
            change.authority ?? this.authority,
            change.path ?? this.path,
            change.query ?? this.query,
            change.fragment ?? this.fragment
        );
    }
}

// ============================================================================
// Position and Range
// ============================================================================

export class Position {
    line: number;
    character: number;

    constructor(line: number, character: number) {
        this.line = line;
        this.character = character;
    }

    isBefore(other: Position): boolean {
        return this.line < other.line || (this.line === other.line && this.character < other.character);
    }

    isEqual(other: Position): boolean {
        return this.line === other.line && this.character === other.character;
    }

    translate(lineDelta?: number, characterDelta?: number): Position {
        return new Position(this.line + (lineDelta || 0), this.character + (characterDelta || 0));
    }
}

export class Range {
    start: Position;
    end: Position;

    constructor(start: Position, end: Position);
    constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
    constructor(a: number | Position, b: number | Position, c?: number, d?: number) {
        if (a instanceof Position && b instanceof Position) {
            this.start = a;
            this.end = b;
        } else {
            this.start = new Position(a as number, b as number);
            this.end = new Position(c as number, d as number);
        }
    }

    isEmpty(): boolean {
        return this.start.isEqual(this.end);
    }

    contains(position: Position): boolean {
        return !position.isBefore(this.start) && position.isBefore(this.end);
    }
}

export class Selection extends Range {
    anchor: Position;
    active: Position;
    isReversed: boolean;

    constructor(anchor: Position, active: Position);
    constructor(anchorLine: number, anchorCharacter: number, activeLine: number, activeCharacter: number);
    constructor(a: number | Position, b: number | Position, c?: number, d?: number) {
        if (a instanceof Position && b instanceof Position) {
            super(a, b);
            this.anchor = a;
            this.active = b;
        } else {
            const anchor = new Position(a as number, b as number);
            const active = new Position(c as number, d as number);
            super(anchor, active);
            this.anchor = anchor;
            this.active = active;
        }
        this.isReversed = this.active.isBefore(this.anchor);
    }
}

// ============================================================================
// TextDocument
// ============================================================================

export class MockTextDocument {
    uri: Uri;
    fileName: string;
    isUntitled: boolean = false;
    languageId: string = 'plaintext';
    version: number = 1;
    isDirty: boolean = false;
    isClosed: boolean = false;
    private content: string;
    private lines: string[];

    constructor(uri: Uri, content: string) {
        this.uri = uri;
        this.fileName = uri.fsPath;
        this.content = content;
        this.lines = content.split('\n');
    }

    getText(range?: Range): string {
        if (!range) return this.content;
        const lines = this.lines.slice(range.start.line, range.end.line + 1);
        if (lines.length === 0) return '';
        lines[0] = lines[0].substring(range.start.character);
        lines[lines.length - 1] = lines[lines.length - 1].substring(0, 
            range.end.line === range.start.line 
                ? range.end.character - range.start.character 
                : range.end.character);
        return lines.join('\n');
    }

    lineAt(line: number): { text: string; range: Range } {
        return {
            text: this.lines[line] || '',
            range: new Range(line, 0, line, (this.lines[line] || '').length),
        };
    }

    positionAt(offset: number): Position {
        let currentOffset = 0;
        for (let i = 0; i < this.lines.length; i++) {
            const lineLength = this.lines[i].length + 1;
            if (currentOffset + lineLength > offset) {
                return new Position(i, offset - currentOffset);
            }
            currentOffset += lineLength;
        }
        return new Position(this.lines.length - 1, 0);
    }

    offsetAt(position: Position): number {
        let offset = 0;
        for (let i = 0; i < position.line; i++) {
            offset += this.lines[i].length + 1;
        }
        return offset + position.character;
    }

    getWordRangeAtPosition(position: Position): Range | undefined {
        const line = this.lines[position.line];
        if (!line) return undefined;
        
        const wordRegex = /\w+/g;
        let match;
        while ((match = wordRegex.exec(line)) !== null) {
            if (match.index <= position.character && match.index + match[0].length >= position.character) {
                return new Range(position.line, match.index, position.line, match.index + match[0].length);
            }
        }
        return undefined;
    }

    save(): Promise<boolean> {
        return Promise.resolve(true);
    }
}

// ============================================================================
// TextEditor
// ============================================================================

export class MockTextEditor {
    document: MockTextDocument;
    selection: Selection;
    selections: Selection[] = [];
    visibleRanges: Range[] = [];
    options: any = {};
    viewColumn: number | undefined = 1;

    constructor(document: MockTextDocument) {
        this.document = document;
        this.selection = new Selection(0, 0, 0, 0);
        this.selections = [this.selection];
    }

    edit(callback: (editBuilder: any) => void): Promise<boolean> {
        return Promise.resolve(true);
    }

    insertSnippet(snippet: any, location?: any): Promise<boolean> {
        return Promise.resolve(true);
    }

    setDecorations(decorationType: any, ranges: any[]): void {}
    revealRange(range: Range, revealType?: any): void {}
    show(column?: any): void {}
    hide(): void {}
}

// ============================================================================
// WorkspaceFolder
// ============================================================================

export class MockWorkspaceFolder {
    uri: Uri;
    name: string;
    index: number;

    constructor(uri: Uri, name: string, index: number = 0) {
        this.uri = uri;
        this.name = name;
        this.index = index;
    }
}

// ============================================================================
// ExtensionContext
// ============================================================================

export class MockExtensionContext {
    subscriptions: { dispose(): any }[] = [];
    workspaceState = new MockMemento();
    globalState = new MockMemento();
    secrets = new MockSecretStorage();
    extensionUri: Uri;
    storageUri: Uri;
    globalStorageUri: Uri;
    logUri: Uri;
    extensionMode: number = 1;
    extension: any;
    environmentVariableCollection: any = {};
    
    // Legacy properties for compatibility
    extensionPath: string;
    storagePath: string | undefined;
    globalStoragePath: string;
    logPath: string;

    constructor(workspacePath: string = '/workspace') {
        this.extensionUri = Uri.file('/extension');
        this.extensionPath = this.extensionUri.fsPath;
        this.storageUri = Uri.file(`${workspacePath}/.vscode/kimi`);
        this.storagePath = this.storageUri.fsPath;
        this.globalStorageUri = Uri.file('/home/user/.config/kimi');
        this.globalStoragePath = this.globalStorageUri.fsPath;
        this.logUri = Uri.file(`${workspacePath}/.vscode/kimi/logs`);
        this.logPath = this.logUri.fsPath;
    }

    asAbsolutePath(relativePath: string): string {
        return `${this.extensionUri.fsPath}/${relativePath}`;
    }
}

class MockMemento {
    private storage = new Map<string, any>();

    get<T>(key: string, defaultValue?: T): T | undefined {
        return this.storage.has(key) ? this.storage.get(key) : defaultValue;
    }

    update(key: string, value: any): Promise<void> {
        this.storage.set(key, value);
        return Promise.resolve();
    }

    keys(): readonly string[] {
        return Array.from(this.storage.keys());
    }
}

class MockSecretStorage {
    private secrets = new Map<string, string>();

    async get(key: string): Promise<string | undefined> {
        return this.secrets.get(key);
    }

    async store(key: string, value: string): Promise<void> {
        this.secrets.set(key, value);
    }

    async delete(key: string): Promise<void> {
        this.secrets.delete(key);
    }

    onDidChange: any = { event: () => ({ dispose: () => {} }) };
}

// ============================================================================
// FileSystem
// ============================================================================

export class MockFileSystem {
    private files = new Map<string, { content: Buffer | string; type: FileType }>();

    setFile(path: string, content: string | Buffer, type: FileType = FileType.File): void {
        this.files.set(path, { content: Buffer.isBuffer(content) ? content : Buffer.from(content), type });
    }

    getFile(path: string): Buffer | undefined {
        const file = this.files.get(path);
        return file?.content as Buffer;
    }

    exists(path: string): boolean {
        return this.files.has(path);
    }

    delete(path: string): void {
        this.files.delete(path);
    }

    clear(): void {
        this.files.clear();
    }

    readFile(uri: Uri): Promise<Uint8Array> {
        const file = this.files.get(uri.fsPath);
        if (!file) throw new Error(`File not found: ${uri.fsPath}`);
        return Promise.resolve(file.content as Uint8Array);
    }

    writeFile(uri: Uri, content: Uint8Array): Promise<void> {
        this.files.set(uri.fsPath, { content: Buffer.from(content), type: FileType.File });
        return Promise.resolve();
    }

    stat(uri: Uri): Promise<{ type: FileType; size: number; ctime: number; mtime: number }> {
        const file = this.files.get(uri.fsPath);
        if (!file) throw new Error(`File not found: ${uri.fsPath}`);
        return Promise.resolve({
            type: file.type,
            size: (file.content as Buffer).length,
            ctime: Date.now(),
            mtime: Date.now(),
        });
    }
}

// ============================================================================
// Workspace
// ============================================================================

export class MockWorkspace {
    workspaceFolders: MockWorkspaceFolder[] | undefined;
    textDocuments: MockTextDocument[] = [];
    private fileSystem = new MockFileSystem();

    constructor(rootPath?: string) {
        if (rootPath) {
            this.workspaceFolders = [new MockWorkspaceFolder(Uri.file(rootPath), 'workspace')];
        }
    }

    getWorkspaceFolder(uri: Uri): MockWorkspaceFolder | undefined {
        if (!this.workspaceFolders) return undefined;
        return this.workspaceFolders.find(folder => uri.fsPath.startsWith(folder.uri.fsPath));
    }

    async findFiles(
        include: string | { base: string; pattern: string },
        exclude?: string | null,
        maxResults?: number
    ): Promise<Uri[]> {
        const pattern = typeof include === 'string' ? include : include.pattern;
        const results: Uri[] = [];
        const regex = this.globToRegex(pattern);
        
        for (const [path] of (this.fileSystem as any).files || []) {
            if (regex.test(path)) {
                results.push(Uri.file(path));
                if (maxResults && results.length >= maxResults) break;
            }
        }
        
        return results;
    }

    private globToRegex(pattern: string): RegExp {
        const regexPattern = pattern
            .replace(/\*\*/g, '{{GLOBSTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.')
            .replace(/\{\{GLOBSTAR\}\}/g, '.*');
        return new RegExp(regexPattern);
    }

    get fs(): MockFileSystem {
        return this.fileSystem;
    }

    registerFile(path: string, content: string): void {
        this.fileSystem.setFile(path, content);
        this.textDocuments.push(new MockTextDocument(Uri.file(path), content));
    }
}

// ============================================================================
// Window
// ============================================================================

export class MockWindow {
    activeTextEditor: MockTextEditor | undefined;
    visibleTextEditors: MockTextEditor[] = [];
    private eventEmitter = new EventEmitter();

    showInformationMessage(message: string, ...items: any[]): Promise<any> {
        return Promise.resolve(items[0]);
    }

    showWarningMessage(message: string, ...items: any[]): Promise<any> {
        return Promise.resolve(items[0]);
    }

    showErrorMessage(message: string, ...items: any[]): Promise<any> {
        return Promise.resolve(items[0]);
    }

    showQuickPick(items: any[], options?: any): Promise<any> {
        return Promise.resolve(items[0]);
    }

    showInputBox(options?: any): Promise<string | undefined> {
        return Promise.resolve('mock-input');
    }

    showOpenDialog(options?: any): Promise<Uri[] | undefined> {
        return Promise.resolve([Uri.file('/mock/path')]);
    }

    showSaveDialog(options?: any): Promise<Uri | undefined> {
        return Promise.resolve(Uri.file('/mock/path'));
    }

    createOutputChannel(name: string): any {
        return {
            append: () => {},
            appendLine: () => {},
            clear: () => {},
            show: () => {},
            hide: () => {},
            dispose: () => {},
        };
    }

    createTextEditorDecorationType(options: any): any {
        return { key: 'mock-decoration' };
    }

    setStatusBarMessage(text: string, timeoutOrThenable?: any): any {
        return { dispose: () => {} };
    }

    createWebviewPanel(viewType: string, title: string, showOptions: any, options?: any): any {
        return {
            webview: {
                html: '',
                postMessage: () => Promise.resolve(true),
                onDidReceiveMessage: () => ({ dispose: () => {} }),
                asWebviewUri: (uri: Uri) => uri,
            },
            onDidDispose: () => ({ dispose: () => {} }),
            onDidChangeViewState: () => ({ dispose: () => {} }),
            reveal: () => {},
            dispose: () => {},
        };
    }

    setActiveEditor(editor: MockTextEditor | undefined): void {
        this.activeTextEditor = editor;
        if (editor && !this.visibleTextEditors.includes(editor)) {
            this.visibleTextEditors.push(editor);
        }
    }
}

// ============================================================================
// Commands
// ============================================================================

export class MockCommands {
    private commands = new Map<string, (...args: any[]) => any>();

    registerCommand(command: string, callback: (...args: any[]) => any): { dispose(): void } {
        this.commands.set(command, callback);
        return { dispose: () => this.commands.delete(command) };
    }

    executeCommand<T>(command: string, ...args: any[]): Promise<T | undefined> {
        const cmd = this.commands.get(command);
        if (cmd) {
            return Promise.resolve(cmd(...args));
        }
        return Promise.resolve(undefined);
    }

    getCommands(filterInternal?: boolean): Promise<string[]> {
        return Promise.resolve(Array.from(this.commands.keys()));
    }
}

// ============================================================================
// Configuration
// ============================================================================

export class MockConfiguration {
    private values = new Map<string, any>();

    get<T>(section: string, defaultValue?: T): T | undefined {
        return this.values.get(section) ?? defaultValue;
    }

    update(section: string, value: any): Promise<void> {
        this.values.set(section, value);
        return Promise.resolve();
    }

    has(section: string): boolean {
        return this.values.has(section);
    }

    inspect(section: string): any {
        return {
            key: section,
            defaultValue: undefined,
            globalValue: this.values.get(section),
            workspaceValue: undefined,
        };
    }
}

// ============================================================================
// Global instances
// ============================================================================

export const workspace = new MockWorkspace('/workspace');
export const window = new MockWindow();
export const commands = new MockCommands();
export const configuration = new MockConfiguration();

// ============================================================================
// Test Helpers
// ============================================================================

export function resetMocks(): void {
    workspace.workspaceFolders = [new MockWorkspaceFolder(Uri.file('/workspace'), 'workspace')];
    workspace.textDocuments = [];
    (workspace.fs as any).files = new Map();
    window.activeTextEditor = undefined;
    window.visibleTextEditors = [];
    (commands as any).commands = new Map();
    (configuration as any).values = new Map();
}

export function createMockDocument(content: string, path: string = '/workspace/test.ts', languageId: string = 'typescript'): MockTextDocument {
    const uri = Uri.file(path);
    const doc = new MockTextDocument(uri, content);
    (doc as any).languageId = languageId;
    return doc;
}

export function createMockEditor(document: MockTextDocument): MockTextEditor {
    return new MockTextEditor(document);
}
