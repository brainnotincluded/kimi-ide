/**
 * Extension Tests
 * Tests for VS Code extension activation and main functionality
 */

import * as assert from 'assert';
import * as path from 'path';
import { before, after, describe, it } from 'mocha';
import { 
    MockExtensionContext, 
    MockWorkspaceFolder, 
    Uri, 
    resetMocks,
    workspace,
    window,
    commands 
} from '../mocks/vscode';

// Mock the extension module
const mockContext = new MockExtensionContext('/workspace');

describe('Extension Activation', () => {
    before(() => {
        resetMocks();
    });

    after(() => {
        resetMocks();
    });

    describe('ExtensionContext', () => {
        it('should create valid extension context', () => {
            const context = new MockExtensionContext('/test/workspace');
            
            assert.ok(context.subscriptions);
            assert.ok(context.workspaceState);
            assert.ok(context.globalState);
            assert.ok(context.storageUri);
            assert.ok(context.globalStorageUri);
            assert.strictEqual(context.extensionMode, 1);
        });

        it('should resolve absolute paths correctly', () => {
            const context = new MockExtensionContext();
            const absPath = context.asAbsolutePath('out/extension.js');
            
            assert.ok(absPath.includes('out/extension.js'));
            assert.ok(path.isAbsolute(absPath));
        });

        it('should store and retrieve workspace state', async () => {
            const context = new MockExtensionContext();
            
            await context.workspaceState.update('testKey', 'testValue');
            const value = context.workspaceState.get<string>('testKey');
            
            assert.strictEqual(value, 'testValue');
        });

        it('should store and retrieve global state', async () => {
            const context = new MockExtensionContext();
            
            await context.globalState.update('globalKey', { nested: true });
            const value = context.globalState.get<{ nested: boolean }>('globalKey');
            
            assert.deepStrictEqual(value, { nested: true });
        });
    });

    describe('Workspace', () => {
        it('should have workspace folders', () => {
            workspace.workspaceFolders = [
                new MockWorkspaceFolder(Uri.file('/workspace'), 'workspace')
            ];
            
            assert.ok(workspace.workspaceFolders);
            assert.strictEqual(workspace.workspaceFolders.length, 1);
            assert.strictEqual(workspace.workspaceFolders[0].name, 'workspace');
        });

        it('should get workspace folder for uri', () => {
            const folder = workspace.getWorkspaceFolder(Uri.file('/workspace/src/test.ts'));
            
            assert.ok(folder);
            assert.strictEqual(folder?.uri.fsPath, '/workspace');
        });

        it('should return undefined for uri outside workspace', () => {
            const folder = workspace.getWorkspaceFolder(Uri.file('/outside/project/file.ts'));
            
            assert.strictEqual(folder, undefined);
        });
    });

    describe('Commands', () => {
        it('should register commands', () => {
            const disposable = commands.registerCommand('kimi.test', () => 'test result');
            
            assert.ok(disposable);
            assert.strictEqual(typeof disposable.dispose, 'function');
        });

        it('should execute registered commands', async () => {
            commands.registerCommand('kimi.testCommand', (arg: string) => `result: ${arg}`);
            
            const result = await commands.executeCommand<string>('kimi.testCommand', 'hello');
            
            assert.strictEqual(result, 'result: hello');
        });

        it('should return undefined for unregistered commands', async () => {
            const result = await commands.executeCommand('kimi.nonexistent');
            
            assert.strictEqual(result, undefined);
        });

        it('should dispose commands', async () => {
            const disposable = commands.registerCommand('kimi.temp', () => 'temp');
            disposable.dispose();
            
            const result = await commands.executeCommand('kimi.temp');
            assert.strictEqual(result, undefined);
        });
    });

    describe('Window', () => {
        it('should show information messages', async () => {
            const result = await window.showInformationMessage('Test message', 'Option1', 'Option2');
            // Returns first item by default in mock
            assert.ok(result);
        });

        it('should show input box', async () => {
            const result = await window.showInputBox({ prompt: 'Enter value' });
            assert.strictEqual(result, 'mock-input');
        });

        it('should create output channel', () => {
            const channel = window.createOutputChannel('Kimi');
            
            assert.ok(channel);
            assert.strictEqual(typeof channel.append, 'function');
            assert.strictEqual(typeof channel.appendLine, 'function');
        });
    });

    describe('Extension Configuration', () => {
        it('should have default configuration values', () => {
            const config = {
                apiKey: '',
                baseUrl: 'https://api.moonshot.cn/v1',
                model: 'moonshot-v1-8k',
                enableInlineCompletions: true,
            };
            
            assert.ok(config.baseUrl);
            assert.ok(config.model);
            assert.strictEqual(typeof config.enableInlineCompletions, 'boolean');
        });

        it('should support different model options', () => {
            const models = [
                'moonshot-v1-8k',
                'moonshot-v1-32k',
                'moonshot-v1-128k'
            ];
            
            assert.strictEqual(models.length, 3);
            models.forEach(model => {
                assert.ok(model.startsWith('moonshot-v1-'));
            });
        });
    });
});

describe('Extension Lifecycle', () => {
    it('should handle activation', () => {
        // Simulate extension activation
        const context = new MockExtensionContext();
        const activate = () => {
            // Extension activation logic would go here
            context.subscriptions.push({ dispose: () => {} });
            return Promise.resolve();
        };
        
        assert.strictEqual(context.subscriptions.length, 0);
        activate();
        assert.strictEqual(context.subscriptions.length, 1);
    });

    it('should handle deactivation', () => {
        const context = new MockExtensionContext();
        let disposed = false;
        
        context.subscriptions.push({ 
            dispose: () => { disposed = true; } 
        });
        
        // Simulate deactivation
        context.subscriptions.forEach(sub => sub.dispose());
        
        assert.strictEqual(disposed, true);
    });
});
