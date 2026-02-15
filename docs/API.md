# API Reference

Complete API reference for Kimi IDE VS Code extension.

## Table of Contents

- [Wire Protocol](#wire-protocol)
- [Extension Commands](#extension-commands)
- [Configuration Options](#configuration-options)
- [Events](#events)
- [TypeScript Types](#typescript-types)

## Wire Protocol

JSON-RPC 2.0 protocol over stdio for communication with kimi-code-cli.

### Message Envelope

```typescript
interface WireMessageEnvelope<T = unknown> {
    jsonrpc: "2.0";
    id?: string | number | null;      // Request/Response ID
    method?: string;                   // Method name or event type
    params?: T;                        // Parameters
    result?: T;                        // Result (responses only)
    error?: WireError;                 // Error (responses only)
}

interface WireError {
    code: number;
    message: string;
    data?: unknown;
}
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid request | JSON-RPC request invalid |
| -32601 | Method not found | Method doesn't exist |
| -32602 | Invalid params | Method parameters invalid |
| -32603 | Internal error | Internal server error |
| -32000 | Server error | Generic server error |
| -32001 | Connection failed | Could not connect to CLI |
| -32002 | Timeout | Request timed out |

### Client → Server Methods

#### `sendMessage`

Send a user message to the AI.

**Request:**
```typescript
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "sendMessage",
    "params": {
        "content": "Hello, Kimi!",
        "context": {
            "current_file": "/path/to/file.ts",
            "selected_text": "const x = 1;",
            "selection_range": {
                "start_line": 10,
                "start_column": 0,
                "end_line": 10,
                "end_column": 12
            },
            "open_files": ["/path/to/file1.ts", "/path/to/file2.ts"],
            "workspace_root": "/path/to/workspace"
        }
    }
}
```

**Response:**
```typescript
{
    "jsonrpc": "2.0",
    "id": 1,
    "result": null
}
```

#### `interruptTurn`

Interrupt the current conversation turn.

**Request:**
```typescript
{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "interruptTurn",
    "params": {
        "turn_id": "turn-123"
    }
}
```

#### `submitApproval`

Submit response to an approval request.

**Request:**
```typescript
{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "submitApproval",
    "params": {
        "request_id": "req-456",
        "approved": true,
        "reason": "Looks good",
        "modifications": {}
    }
}
```

#### `ping`

Health check.

**Request:**
```typescript
{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "ping",
    "params": {}
}
```

**Response:**
```typescript
{
    "jsonrpc": "2.0",
    "id": 4,
    "result": "pong"
}
```

### Server → Client Events

#### `TurnBegin`

A new conversation turn has started.

```typescript
{
    "jsonrpc": "2.0",
    "method": "TurnBegin",
    "params": {
        "turn_id": "turn-123",
        "user_input": "Hello, Kimi!",
        "context": {
            "files": ["/path/to/file.ts"],
            "selections": [{
                "file_path": "/path/to/file.ts",
                "start_line": 10,
                "start_column": 0,
                "end_line": 10,
                "end_column": 12,
                "content": "const x = 1;"
            }]
        }
    }
}
```

#### `TurnEnd`

A conversation turn has ended.

```typescript
{
    "jsonrpc": "2.0",
    "method": "TurnEnd",
    "params": {
        "turn_id": "turn-123",
        "finish_reason": "completed",  // "completed" | "interrupted" | "error"
        "error": null  // Error message if finish_reason is "error"
    }
}
```

#### `StepBegin`

A step within a turn has started.

```typescript
{
    "jsonrpc": "2.0",
    "method": "StepBegin",
    "params": {
        "step_id": "step-456",
        "turn_id": "turn-123",
        "type": "thinking"  // "thinking" | "tool_call" | "response"
    }
}
```

#### `StepEnd`

A step has completed.

```typescript
{
    "jsonrpc": "2.0",
    "method": "StepEnd",
    "params": {
        "step_id": "step-456",
        "turn_id": "turn-123",
        "status": "success"  // "success" | "error" | "cancelled"
    }
}
```

#### `ContentPart`

Content chunk (streaming response).

```typescript
{
    "jsonrpc": "2.0",
    "method": "ContentPart",
    "params": {
        "type": "text",
        "text": "Hello! Here's the code:"
    }
}
```

Content part types:

**TextPart:**
```typescript
{
    "type": "text",
    "text": "Plain text content"
}
```

**ThinkPart:**
```typescript
{
    "type": "think",
    "content": "AI reasoning process"
}
```

**ToolCallPart:**
```typescript
{
    "type": "tool_call",
    "tool_call": {
        "id": "call-789",
        "name": "read_file",
        "arguments": {
            "path": "/path/to/file.ts"
        }
    }
}
```

**ToolResultPart:**
```typescript
{
    "type": "tool_result",
    "tool_call_id": "call-789",
    "content": "file content here",
    "is_error": false
}
```

#### `ToolCall`

Tool execution request.

```typescript
{
    "jsonrpc": "2.0",
    "method": "ToolCall",
    "params": {
        "id": "call-789",
        "name": "write_file",
        "arguments": {
            "path": "/path/to/file.ts",
            "content": "// new content"
        }
    }
}
```

#### `ToolResult`

Tool execution result.

```typescript
{
    "jsonrpc": "2.0",
    "method": "ToolResult",
    "params": {
        "tool_call_id": "call-789",
        "name": "write_file",
        "content": "File written successfully",
        "is_error": false,
        "execution_time_ms": 150
    }
}
```

#### `ApprovalRequest`

User approval needed for sensitive operation.

```typescript
{
    "jsonrpc": "2.0",
    "method": "ApprovalRequest",
    "params": {
        "request_id": "req-456",
        "turn_id": "turn-123",
        "type": "file_write",  // "tool_call" | "file_write" | "command_execute" | "external_request"
        "description": "Write to file /path/to/file.ts",
        "details": {
            "file_path": "/path/to/file.ts",
            "content_preview": "// file content preview",
            "is_create": false,
            "is_delete": false
        },
        "timeout_ms": 30000
    }
}
```

Approval types and their details:

**Tool Approval:**
```typescript
{
    "type": "tool_call",
    "details": {
        "tool_name": "execute_command",
        "arguments": { "command": "npm install" }
    }
}
```

**File Write Approval:**
```typescript
{
    "type": "file_write",
    "details": {
        "file_path": "/path/to/file.ts",
        "content_preview": "// preview of changes",
        "is_create": true,
        "is_delete": false
    }
}
```

**Command Approval:**
```typescript
{
    "type": "command_execute",
    "details": {
        "command": "npm test",
        "cwd": "/path/to/project",
        "env": { "NODE_ENV": "test" }
    }
}
```

**External Request Approval:**
```typescript
{
    "type": "external_request",
    "details": {
        "url": "https://api.example.com/data",
        "method": "POST",
        "headers": { "Authorization": "Bearer token" },
        "body_preview": "{ \"key\": \"value\" }"
    }
}
```

#### `StatusUpdate`

Connection status update.

```typescript
{
    "jsonrpc": "2.0",
    "method": "StatusUpdate",
    "params": {
        "type": "busy",  // "connected" | "disconnected" | "busy" | "idle" | "error"
        "message": "Processing request...",
        "progress": {
            "current": 50,
            "total": 100,
            "message": "Analyzing code"
        }
    }
}
```

#### `Error`

Error notification.

```typescript
{
    "jsonrpc": "2.0",
    "method": "Error",
    "params": {
        "code": -32000,
        "message": "Failed to process request",
        "data": { "turn_id": "turn-123" }
    }
}
```

## Extension Commands

All commands available through VS Code command palette.

### Inline Edit Commands

| Command | ID | Arguments | Description |
|---------|-----|-----------|-------------|
| Edit Selection | `kimi.inlineEdit` | - | Open inline edit for selection |
| Accept Edit | `kimi.acceptEdit` | - | Accept suggested changes |
| Reject Edit | `kimi.rejectEdit` | - | Reject suggested changes |
| Show Diff | `kimi.showDiff` | - | Show diff view |

### Code Action Commands

| Command | ID | When | Description |
|---------|-----|------|-------------|
| Explain Code | `kimi.explainCode` | `editorHasSelection` | Explain selected code |
| Fix Code | `kimi.fixCode` | `editorHasSelection` | Fix issues in code |
| Optimize Code | `kimi.optimizeCode` | `editorHasSelection` | Optimize selected code |
| Generate Tests | `kimi.generateTests` | `editorHasSelection` | Generate unit tests |
| Add Documentation | `kimi.addDocs` | `editorHasSelection` | Add documentation |
| Refactor Code | `kimi.refactorCode` | `editorHasSelection` | Refactor code structure |

### Chat Commands

| Command | ID | Description |
|---------|-----|-------------|
| Quick Chat | `kimi.quickChat` | Open quick chat input |
| Chat with Current File | `kimi.chatWithContext` | Chat about current file |

### Configuration Commands

| Command | ID | Description |
|---------|-----|-------------|
| Configure API Key | `kimi.configureApiKey` | Set up API key |
| Validate API Key | `kimi.validateApiKey` | Verify API key validity |
| Open Settings | `kimi.openSettings` | Open extension settings |

### Programmatic Usage

```typescript
// Execute a command
await vscode.commands.executeCommand('kimi.inlineEdit');

// Execute with arguments (if supported)
await vscode.commands.executeCommand('kimi.explainCode');
```

## Configuration Options

All configuration options under `kimi.*` namespace.

### Core Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `kimi.apiKey` | `string` | `""` | Moonshot AI API key |
| `kimi.baseUrl` | `string` | `https://api.moonshot.cn/v1` | API base URL |
| `kimi.model` | `enum` | `moonshot-v1-8k` | Model to use |

**Available Models:**
- `moonshot-v1-8k` - 8K context window
- `moonshot-v1-32k` - 32K context window  
- `moonshot-v1-128k` - 128K context window

### Feature Toggles

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `kimi.enableInlineCompletions` | `boolean` | `true` | Enable ghost text completions |
| `kimi.enableLSP` | `boolean` | `true` | Enable Language Server Protocol |
| `kimi.hasSeenWelcome` | `boolean` | `false` | Whether welcome message was shown |

### LSP Settings

| Setting | Type | Default | Range | Description |
|---------|------|---------|-------|-------------|
| `kimi.lsp.completionDebounceMs` | `number` | `300` | 100-2000 | Debounce for completions (ms) |
| `kimi.lsp.maxCompletions` | `number` | `5` | 1-10 | Maximum completions shown |
| `kimi.lsp.cacheTimeout` | `number` | `300` | 60-600 | Cache timeout (seconds) |

### Configuration Example

```json
{
    "kimi.apiKey": "${env:KIMI_API_KEY}",
    "kimi.baseUrl": "https://api.moonshot.cn/v1",
    "kimi.model": "moonshot-v1-32k",
    "kimi.enableInlineCompletions": true,
    "kimi.enableLSP": true,
    "kimi.lsp.completionDebounceMs": 300,
    "kimi.lsp.maxCompletions": 5,
    "kimi.lsp.cacheTimeout": 300
}
```

### Accessing Configuration

```typescript
// Get configuration
const config = vscode.workspace.getConfiguration('kimi');
const apiKey = config.get<string>('apiKey');
const model = config.get<string>('model', 'moonshot-v1-8k');

// Update configuration
await config.update('apiKey', 'new-key', true);  // Global
await config.update('model', 'moonshot-v1-32k', false);  // Workspace

// Listen for changes
vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('kimi')) {
        // Handle config change
    }
});
```

## Events

### Wire Protocol Events

Events emitted by `WireClient`:

```typescript
// Turn events
wireClient.on('TurnBegin', (payload: TurnBeginPayload) => {
    console.log('Turn started:', payload.turn_id);
});

wireClient.on('TurnEnd', (payload: TurnEndPayload) => {
    console.log('Turn ended:', payload.finish_reason);
});

// Step events
wireClient.on('StepBegin', (payload: StepBeginPayload) => {
    console.log('Step started:', payload.type);
});

wireClient.on('StepEnd', (payload: StepEndPayload) => {
    console.log('Step ended:', payload.status);
});

// Content events
wireClient.on('ContentPart', (part: ContentPart) => {
    if (part.type === 'text') {
        console.log('Text:', part.text);
    }
});

// Tool events
wireClient.on('ToolCall', (toolCall: ToolCall) => {
    console.log('Tool called:', toolCall.name);
});

wireClient.on('ToolResult', (result: ToolResult) => {
    console.log('Tool result:', result.content);
});

// Approval events
wireClient.on('ApprovalRequest', (request: ApprovalRequestPayload) => {
    console.log('Approval needed:', request.description);
    // Show approval UI
});

// Status events
wireClient.on('StatusUpdate', (status: StatusUpdatePayload) => {
    console.log('Status:', status.type, status.message);
});

// Error events
wireClient.on('Error', (error: WireError) => {
    console.error('Wire error:', error.message);
});

// Connection events
wireClient.on('connected', () => {
    console.log('Connected to kimi-cli');
});

wireClient.on('disconnected', () => {
    console.log('Disconnected from kimi-cli');
});
```

### VS Code Events

```typescript
// Editor events
vscode.window.onDidChangeTextEditorSelection(e => {
    const hasSelection = !e.selections[0].isEmpty;
    // Update context
});

// Configuration events
vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('kimi')) {
        // Reload config
    }
});
```

## TypeScript Types

### Core Types

```typescript
// src/kimi/wireTypes.ts

// Message context
interface MessageContext {
    current_file?: string;
    selected_text?: string;
    selection_range?: {
        start_line: number;
        start_column: number;
        end_line: number;
        end_column: number;
    };
    open_files?: string[];
    workspace_root?: string;
}

// Content parts
interface TextPart {
    type: 'text';
    text: string;
}

interface ThinkPart {
    type: 'think';
    content: string;
}

interface ImageURLPart {
    type: 'image_url';
    url: string;
    mime_type?: string;
}

interface ImageDataPart {
    type: 'image_data';
    data: string;  // base64 encoded
    mime_type: string;
}

interface ErrorPart {
    type: 'error';
    message: string;
    code?: string;
}

type ContentPart = TextPart | ThinkPart | ImageURLPart | ImageDataPart | ToolCallPart | ToolResultPart | ErrorPart;

// Event map for type-safe event handling
interface WireEventMap {
    TurnBegin: TurnBeginPayload;
    TurnEnd: TurnEndPayload;
    TurnInterrupted: TurnInterruptedPayload;
    StepBegin: StepBeginPayload;
    StepEnd: StepEndPayload;
    ContentPart: ContentPart;
    ToolCall: ToolCall;
    ToolResult: ToolResult;
    ApprovalRequest: ApprovalRequestPayload;
    StatusUpdate: StatusUpdatePayload;
    Error: WireError;
}

type WireEventType = keyof WireEventMap;
```

### API Types

```typescript
// src/kimi/apiAdapter.ts

interface KimiApiResponse {
    content: string;
    error?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

interface KimiApiOptions {
    signal?: AbortSignal;
    temperature?: number;
    maxTokens?: number;
}
```

### Configuration Types

```typescript
// src/config.ts

interface KimiConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
    enableCodeActions: boolean;
    enableInlineEdit: boolean;
    enableStatusBar: boolean;
    debug: boolean;
}
```

### VS Code Extension Types

```typescript
// Activation context
interface ExtensionContext {
    subscriptions: Disposable[];
    workspaceState: Memento;
    globalState: Memento;
    extensionPath: string;
    extensionUri: Uri;
    environmentVariableCollection: EnvironmentVariableCollection;
}
```

## Usage Examples

### Using WireClient

```typescript
import { WireClient } from './kimi/wire';

const client = new WireClient({
    cliPath: '/usr/local/bin/kimi',
    cwd: '/path/to/project',
    debug: true
});

// Connect
await client.connect();

// Listen for events
client.on('ContentPart', (part) => {
    if (part.type === 'text') {
        process.stdout.write(part.text);
    }
});

// Send message
await client.sendMessage('Hello, Kimi!', {
    current_file: '/path/to/file.ts',
    selected_text: 'const x = 1;'
});

// Cleanup
await client.disconnect();
```

### Using KimiApi

```typescript
import { KimiApi } from './kimi/apiAdapter';

const api = new KimiApi();

// Generate response
const response = await api.generateResponse(
    'Explain this code: const x = 1;',
    { temperature: 0.3, maxTokens: 500 }
);

if (response.error) {
    console.error('Error:', response.error);
} else {
    console.log('Response:', response.content);
    console.log('Tokens used:', response.usage?.totalTokens);
}

// Streaming response
for await (const chunk of api.streamResponse('Write a function')) {
    process.stdout.write(chunk);
}
```
