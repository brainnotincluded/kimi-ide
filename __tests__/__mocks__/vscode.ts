/**
 * VS Code API Mock for Jest Tests
 * Enhanced mock implementation of vscode module
 */

import { EventEmitter } from 'events';

// ============================================================================
// Enums
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

export enum ExtensionMode {
    Production = 1,
    Development = 2,
    Test = 3,
}

export enum EndOfLine {
    LF = 1,
    CRLF = 2,
}

export enum OverviewRulerLane {
    Left = 1,
    Center = 2,
    Right = 4,
    Full = 7,
}

export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3,
}

export enum CompletionItemKind {
    Text = 0,
    Method = 1,
    Function = 2,
    Constructor = 3,
    Field = 4,
    Variable = 5,
    Class = 6,
    Interface = 7,
    Module = 8,
    Property = 9,
    Unit = 10,
    Value = 11,
    Enum = 12,
    Keyword = 13,
    Snippet = 14,
    Color = 15,
    Reference = 17,
    File = 16,
    Folder = 19,
    EnumMember = 20,
    Constant = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25,
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

    static parse(value: string, strict?: boolean): Uri {
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

    toString(skipEncoding?: boolean): string {
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

    isBeforeOrEqual(other: Position): boolean {
        return this.line < other.line || (this.line === other.line && this.character <= other.character);
    }

    isAfter(other: Position): boolean {
        return this.line > other.line || (this.line === other.line && this.character > other.character);
    }

    isAfterOrEqual(other: Position): boolean {
        return this.line > other.line || (this.line === other.line && this.character >= other.character);
    }

    isEqual(other: Position): boolean {
        return this.line === other.line && this.character === other.character;
    }

    compareTo(other: Position): number {
        if (this.line < other.line) return -1;
        if (this.line > other.line) return 1;
        return this.character - other.character;
    }

    translate(lineDelta?: number, characterDelta?: number): Position {
        return new Position(this.line + (lineDelta || 0), this.character + (characterDelta || 0));
    }

    with(line?: number, character?: number): Position {
        return new Position(line ?? this.line, character ?? this.character);
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

    get isEmpty(): boolean {
        return this.start.isEqual(this.end);
    }

    get isSingleLine(): boolean {
        return this.start.line === this.end.line;
    }

    contains(positionOrRange: Position | Range): boolean {
        if (positionOrRange instanceof Position) {
            return !positionOrRange.isBefore(this.start) && !positionOrRange.isAfter(this.end);
        }
        return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
    }

    isEqual(other: Range): boolean {
        return this.start.isEqual(other.start) && this.end.isEqual(other.end);
    }

    intersection(range: Range): Range | undefined {
        const start = this.start.isAfter(range.start) ? this.start : range.start;
        const end = this.end.isBefore(range.end) ? this.end : range.end;
        if (start.isAfter(end)) return undefined;
        return new Range(start, end);
    }

    union(range: Range): Range {
        const start = this.start.isBefore(range.start) ? this.start : range.start;
        const end = this.end.isAfter(range.end) ? this.end : range.end;
        return new Range(start, end);
    }

    with(start?: Position, end?: Position): Range {
        return new Range(start ?? this.start, end ?? this.end);
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
    lineCount: number;
    eol: EndOfLine = EndOfLine.LF;
    private content: string;
    private lines: string[];

    constructor(uri: Uri, content: string, languageId?: string) {
        this.uri = uri;
        this.fileName = uri.fsPath;
        this.content = content;
        this.lines = content.split('\n');
        this.lineCount = this.lines.length;
        if (languageId) {
            this.languageId = languageId;
        }
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

    lineAt(line: number | Position): { text: string; range: Range; lineNumber: number } {
        const lineNum = line instanceof Position ? line.line : line;
        return {
            text: this.lines[lineNum] || '',
            range: new Range(lineNum, 0, lineNum, (this.lines[lineNum] || '').length),
            lineNumber: lineNum,
        };
    }

    offsetAt(position: Position): number {
        let offset = 0;
        for (let i = 0; i < position.line; i++) {
            offset += this.lines[i].length + 1;
        }
        return offset + position.character;
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

    getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined {
        const line = this.lines[position.line];
        if (!line) return undefined;
        
        const wordRegex = regex || /\w+/g;
        let match;
        while ((match = wordRegex.exec(line)) !== null) {
            if (match.index <= position.character && match.index + match[0].length >= position.character) {
                return new Range(position.line, match.index, position.line, match.index + match[0].length);
            }
        }
        return undefined;
    }

    validateRange(range: Range): Range {
        return range;
    }

    validatePosition(position: Position): Position {
        return position;
    }

    save(): Promise<boolean> {
        return Promise.resolve(true);
    }

    getTextInRange(range: Range): string {
        return this.getText(range);
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
    options: any = {
        tabSize: 4,
        insertSpaces: true,
        cursorStyle: 1,
        lineNumbers: 1,
    };
    viewColumn: number | undefined = 1;
    editInProgress: boolean = false;

    constructor(document: MockTextDocument) {
        this.document = document;
        this.selection = new Selection(0, 0, 0, 0);
        this.selections = [this.selection];
    }

    edit(callback: (editBuilder: any) => void, options?: { undoStopBefore: boolean; undoStopAfter: boolean }): Promise<boolean> {
        this.editInProgress = true;
        const builder = {
            replace: jest.fn(),
            insert: jest.fn(),
            delete: jest.fn(),
        };
        callback(builder);
        this.editInProgress = false;
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
    onDidChange: any = { event: () => ({ dispose: () => {} }) };

    async get(key: string): Promise<string | undefined> {
        return this.secrets.get(key);
    }

    async store(key: string, value: string): Promise<void> {
        this.secrets.set(key, value);
    }

    async delete(key: string): Promise<void> {
        this.secrets.delete(key);
    }
}

export class MockExtensionContext {
    subscriptions: { dispose(): any }[] = [];
    workspaceState = new MockMemento();
    globalState = new MockMemento();
    secrets = new MockSecretStorage();
    extensionUri: Uri;
    storageUri: Uri;
    globalStorageUri: Uri;
    logUri: Uri;
    extensionMode: ExtensionMode = ExtensionMode.Test;
    extension: any;
    environmentVariableCollection: any = {};
    
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

// ============================================================================
// Mock Classes
// ============================================================================

class MockConfiguration {
    private values = new Map<string, any>();

    get<T>(section: string, defaultValue?: T): T | undefined {
        return this.values.get(section) ?? defaultValue;
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
            workspaceFolderValue: undefined,
        };
    }

    update(section: string, value: any, global?: boolean): Promise<void> {
        this.values.set(section, value);
        return Promise.resolve();
    }
}

class MockFileSystem {
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

    readDirectory(uri: Uri): Promise<[string, FileType][]> {
        return Promise.resolve([]);
    }

    createDirectory(uri: Uri): Promise<void> {
        return Promise.resolve();
    }

    deleteFile(uri: Uri, options?: { recursive?: boolean; useTrash?: boolean }): Promise<void> {
        this.files.delete(uri.fsPath);
        return Promise.resolve();
    }

    rename(oldUri: Uri, newUri: Uri, options?: { overwrite?: boolean }): Promise<void> {
        const file = this.files.get(oldUri.fsPath);
        if (file) {
            this.files.set(newUri.fsPath, file);
            this.files.delete(oldUri.fsPath);
        }
        return Promise.resolve();
    }
}

class MockOutputChannel {
    name: string;
    private content: string[] = [];

    constructor(name: string) {
        this.name = name;
    }

    append(value: string): void {
        this.content.push(value);
    }

    appendLine(value: string): void {
        this.content.push(value + '\n');
    }

    clear(): void {
        this.content = [];
    }

    show(): void {}
    hide(): void {}
    dispose(): void {}

    getContent(): string {
        return this.content.join('');
    }
}

class MockWorkspace {
    workspaceFolders: MockWorkspaceFolder[] | undefined;
    textDocuments: MockTextDocument[] = [];
    private fileSystem = new MockFileSystem();
    private eventEmitter = new EventEmitter();

    constructor(rootPath?: string) {
        if (rootPath) {
            this.workspaceFolders = [new MockWorkspaceFolder(Uri.file(rootPath), 'workspace')];
        }
    }

    getWorkspaceFolder(uri: Uri): MockWorkspaceFolder | undefined {
        if (!this.workspaceFolders) return undefined;
        return this.workspaceFolders.find(folder => uri.fsPath.startsWith(folder.uri.fsPath));
    }

    asRelativePath(pathOrUri: string | Uri, includeWorkspaceFolder?: boolean): string {
        const path = typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.fsPath;
        const folder = this.workspaceFolders?.[0];
        if (!folder) return path;
        if (path.startsWith(folder.uri.fsPath)) {
            return path.substring(folder.uri.fsPath.length + 1);
        }
        return path;
    }

    createFileSystemWatcher(globPattern: string, ignoreCreateEvents?: boolean, ignoreChangeEvents?: boolean, ignoreDeleteEvents?: boolean): any {
        return {
            ignoreCreateEvents: ignoreCreateEvents || false,
            ignoreChangeEvents: ignoreChangeEvents || false,
            ignoreDeleteEvents: ignoreDeleteEvents || false,
            onDidCreate: { event: () => ({ dispose: () => {} }) },
            onDidChange: { event: () => ({ dispose: () => {} }) },
            onDidDelete: { event: () => ({ dispose: () => {} }) },
            dispose: () => {},
        };
    }

    findFiles(
        include: string | { base: string; pattern: string },
        exclude?: string | null,
        maxResults?: number,
        token?: any
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
        
        return Promise.resolve(results);
    }

    private globToRegex(pattern: string): RegExp {
        const regexPattern = pattern
            .replace(/\*\*/g, '{{GLOBSTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.')
            .replace(/\{\{GLOBSTAR\}\}/g, '.*');
        return new RegExp(regexPattern);
    }

    getConfiguration(section?: string, scope?: any): MockConfiguration {
        return new MockConfiguration();
    }

    openTextDocument(uri: Uri | string): Promise<MockTextDocument> {
        const fileUri = typeof uri === 'string' ? Uri.file(uri) : uri;
        const doc = new MockTextDocument(fileUri, '');
        this.textDocuments.push(doc);
        return Promise.resolve(doc);
    }

    saveAll(includeUntitled?: boolean): Promise<boolean> {
        return Promise.resolve(true);
    }

    applyEdit(edit: any): Promise<boolean> {
        return Promise.resolve(true);
    }

    get fs(): MockFileSystem {
        return this.fileSystem;
    }

    registerFile(path: string, content: string, languageId?: string): void {
        this.fileSystem.setFile(path, content);
        this.textDocuments.push(new MockTextDocument(Uri.file(path), content, languageId));
    }
}

class MockWindow {
    activeTextEditor: MockTextEditor | undefined;
    visibleTextEditors: MockTextEditor[] = [];
    private outputChannels = new Map<string, MockOutputChannel>();
    private eventEmitter = new EventEmitter();

    showInformationMessage<T extends string>(message: string, ...items: T[]): Promise<T | undefined>;
    showInformationMessage<T extends string>(message: string, options: any, ...items: T[]): Promise<T | undefined>;
    showInformationMessage(message: string, ...args: any[]): Promise<any> {
        const items = args.filter(arg => typeof arg === 'string');
        return Promise.resolve(items[0]);
    }

    showWarningMessage<T extends string>(message: string, ...items: T[]): Promise<T | undefined>;
    showWarningMessage<T extends string>(message: string, options: any, ...items: T[]): Promise<T | undefined>;
    showWarningMessage(message: string, ...args: any[]): Promise<any> {
        const items = args.filter(arg => typeof arg === 'string');
        return Promise.resolve(items[0]);
    }

    showErrorMessage<T extends string>(message: string, ...items: T[]): Promise<T | undefined>;
    showErrorMessage<T extends string>(message: string, options: any, ...items: T[]): Promise<T | undefined>;
    showErrorMessage(message: string, ...args: any[]): Promise<any> {
        const items = args.filter(arg => typeof arg === 'string');
        return Promise.resolve(items[0]);
    }

    showQuickPick<T extends string>(items: T[], options?: any, token?: any): Promise<T | undefined>;
    showQuickPick<T extends any>(items: T[], options?: any, token?: any): Promise<T | undefined>;
    showQuickPick(items: any[], options?: any, token?: any): Promise<any> {
        return Promise.resolve(items[0]);
    }

    showInputBox(options?: any, token?: any): Promise<string | undefined> {
        return Promise.resolve('mock-input');
    }

    showOpenDialog(options?: any): Promise<Uri[] | undefined> {
        return Promise.resolve([Uri.file('/mock/path')]);
    }

    showSaveDialog(options?: any): Promise<Uri | undefined> {
        return Promise.resolve(Uri.file('/mock/path'));
    }

    createOutputChannel(name: string, options?: string | { log?: boolean }): MockOutputChannel {
        const channel = new MockOutputChannel(name);
        this.outputChannels.set(name, channel);
        return channel;
    }

    createTextEditorDecorationType(options: any): any {
        return { key: 'mock-decoration' };
    }

    setStatusBarMessage(text: string, timeoutOrThenable?: any): { dispose(): void } {
        return { dispose: () => {} };
    }

    withProgress<R>(options: any, task: (progress: any, token: any) => Thenable<R>): Promise<R> {
        return Promise.resolve(task({ report: () => {} }, { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) }));
    }

    createWebviewPanel(viewType: string, title: string, showOptions: any, options?: any): any {
        return {
            webview: {
                html: '',
                options: {},
                postMessage: () => Promise.resolve(true),
                onDidReceiveMessage: () => ({ dispose: () => {} }),
                asWebviewUri: (uri: Uri) => uri,
                cspSource: '',
            },
            viewType,
            title,
            onDidDispose: () => ({ dispose: () => {} }),
            onDidChangeViewState: () => ({ dispose: () => {} }),
            reveal: () => {},
            dispose: () => {},
            visible: true,
            active: true,
            options: {},
            viewColumn: 1,
        };
    }

    showTextDocument(document: MockTextDocument, options?: any): Promise<MockTextEditor> {
        const editor = new MockTextEditor(document);
        this.activeTextEditor = editor;
        if (!this.visibleTextEditors.includes(editor)) {
            this.visibleTextEditors.push(editor);
        }
        return Promise.resolve(editor);
    }

    getOutputChannel(name: string): MockOutputChannel | undefined {
        return this.outputChannels.get(name);
    }
}

class MockCommands {
    private commands = new Map<string, (...args: any[]) => any>();

    registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): { dispose(): void } {
        this.commands.set(command, thisArg ? callback.bind(thisArg) : callback);
        return { dispose: () => this.commands.delete(command) };
    }

    registerTextEditorCommand(command: string, callback: (textEditor: MockTextEditor, edit: any, ...args: any[]) => void, thisArg?: any): { dispose(): void } {
        return this.registerCommand(command, (...args: any[]) => {
            // Mock implementation
        }, thisArg);
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

class MockLanguages {
    createDiagnosticCollection(name?: string): any {
        return {
            name: name || '',
            set: jest.fn(),
            delete: jest.fn(),
            clear: jest.fn(),
            forEach: jest.fn(),
            get: jest.fn(),
            has: jest.fn(),
            dispose: jest.fn(),
        };
    }

    registerCodeActionsProvider(selector: any, provider: any, metadata?: any): { dispose(): void } {
        return { dispose: () => {} };
    }

    registerCompletionItemProvider(selector: any, provider: any, ...triggerCharacters: string[]): { dispose(): void } {
        return { dispose: () => {} };
    }

    registerHoverProvider(selector: any, provider: any): { dispose(): void } {
        return { dispose: () => {} };
    }

    registerSignatureHelpProvider(selector: any, provider: any, ...triggerCharacters: string[]): { dispose(): void } {
        return { dispose: () => {} };
    }
}

// ============================================================================
// Global Instances
// ============================================================================

export const workspace = new MockWorkspace('/workspace');
export const window = new MockWindow();
export const commands = new MockCommands();
export const languages = new MockLanguages();

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
}

export function createMockDocument(content: string, path: string = '/workspace/test.ts', languageId: string = 'typescript'): MockTextDocument {
    const uri = Uri.file(path);
    const doc = new MockTextDocument(uri, content, languageId);
    return doc;
}

export function createMockEditor(document: MockTextDocument): MockTextEditor {
    return new MockTextEditor(document);
}

// ============================================================================
// Export main vscode object
// ============================================================================

export default {
    // Enums
    SymbolKind,
    FileType,
    ExtensionMode,
    EndOfLine,
    OverviewRulerLane,
    DiagnosticSeverity,
    CompletionItemKind,
    
    // Classes
    Uri,
    Position,
    Range,
    Selection,
    MockTextDocument: TextDocument,
    MockTextEditor: TextEditor,
    
    // Namespaces
    workspace,
    window,
    commands,
    languages,
    
    // Functions
    resetMocks,
};

// Compatibility exports
export const TextDocument = MockTextDocument;
export const TextEditor = MockTextEditor;
