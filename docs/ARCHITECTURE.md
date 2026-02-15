# Architecture Overview

Technical architecture and design of the Kimi IDE VS Code extension.

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [Component Diagram](#component-diagram)
- [Wire Protocol](#wire-protocol)
- [Communication Flow](#communication-flow)
- [Project Structure](#project-structure)
- [Key Components](#key-components)
- [Data Flow](#data-flow)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VS Code Extension Host                            │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Commands   │  │  Providers   │  │     LSP      │  │     UI       │   │
│  │              │  │              │  │   Client     │  │   Panels     │   │
│  │ • inlineEdit │  │ • InlineEdit │  │              │  │              │   │
│  │ • quickChat  │  │ • Diff       │  │ • Completion │  │ • Chat       │   │
│  │ • explain    │  │ • CodeAction │  │ • Hover      │  │ • Message    │   │
│  │              │  │ • Completion │  │ • Signature  │  │   Renderer   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │                 │           │
│         └─────────────────┴────────┬────────┴─────────────────┘           │
│                                    │                                       │
│                           ┌────────▼────────┐                              │
│                           │   KimiApi       │                              │
│                           │   (Adapter)     │                              │
│                           └────────┬────────┘                              │
│                                    │                                       │
└────────────────────────────────────┼──────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
        ┌───────────────────┐            ┌───────────────────┐
        │   HTTP API Mode   │            │  Wire Protocol    │
        │                   │            │      Mode         │
        │ • Direct fetch    │            │                   │
        │ • REST calls      │            │ • JSON-RPC/stdio  │
        │ • Simple async    │            │ • Streaming       │
        │                   │            │ • Bidirectional   │
        └─────────┬─────────┘            │ • Tool execution  │
                  │                      └─────────┬─────────┘
                  │                                │
                  ▼                                ▼
        ┌───────────────────┐            ┌───────────────────┐
        │  Moonshot AI API  │            │   kimi-code-cli   │
        │  api.moonshot.cn  │            │   (local process) │
        └───────────────────┘            └───────────────────┘
```

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Extension Entry Point                       │
│                      src/extension.ts                           │
│                                                                 │
│  activate(context)                                              │
│    ├── initialize KimiApi                                       │
│    ├── initialize Providers                                     │
│    ├── start LSP Client (optional)                              │
│    ├── register Commands                                        │
│    └── show Welcome Message                                     │
└─────────────────────────────────────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  src/commands/  │  │ src/providers/  │  │    src/lsp/     │
│                 │  │                 │  │                 │
│ • inlineEdit    │  │ • InlineEdit    │  │ • Language      │
│ • quickChat     │  │ • Diff          │  │   Client        │
│ • explainCode   │  │ • CodeAction    │  │ • Completion    │
│ • fixCode       │  │ • Completion    │  │   Provider      │
│ • etc.          │  │                 │  │ • Hover         │
│                 │  │                 │  │   Provider      │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┴────────┬───────────┘
                                       ▼
                         ┌─────────────────────────┐
                         │    src/kimi/apiAdapter  │
                         │                         │
                         │  • generateResponse()   │
                         │  • generateEdit()       │
                         │  • streamResponse()     │
                         │  • validateApiKey()     │
                         └───────────┬─────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
        ┌─────────────────────┐          ┌─────────────────────┐
        │  src/kimi/kimiClient│          │   HTTP Mode         │
        │  (Wire Protocol)    │          │   (Direct Fetch)    │
│       │                     │          │                     │
│       │  • sendMessage()    │          │  • fetch() to API   │
│       │  • interruptTurn()  │          │  • REST endpoints   │
│       │  • submitApproval() │          │  • Simple request   │
│       │                     │          │                     │
│       └──────────┬──────────┘          └─────────────────────┘
│                  │
│                  ▼
│       ┌─────────────────────┐
│       │ src/kimi/wire.ts    │
│       │ (Wire Client)       │
│       │                     │
│       │  • JSON-RPC over    │
│       │    stdio            │
│       │  • Event-driven     │
│       │  • Auto-reconnect   │
│       └─────────────────────┘
│
└──────────────────────────────────────────────────────────────────┐
                        Supporting Modules                         │
                                                                   │
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
   │  src/config  │  │src/context/  │  │ src/utils/   │           │
   │              │  │              │  │              │           │
   │ • getConfig  │  │ • Prompt     │  │ • Editor     │           │
   │ • API key    │  │   Builder    │  │   utils      │           │
   │   management │  │ • Context    │  │ • File utils │           │
   │              │  │   Resolver   │  │ • Logger     │           │
   └──────────────┘  └──────────────┘  └──────────────┘           │
                                                                   │
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
   │ src/panels/  │  │src/terminal/ │  │ src/types/   │           │
   │              │  │              │  │              │           │
   │ • Chat Panel │  │ • Terminal   │  │ • Type       │           │
   │ • Message    │  │   Manager    │  │   Definitions│           │
   │   Renderer   │  │ • Shell      │  │              │           │
   │              │  │   Integration│  │              │           │
   └──────────────┘  └──────────────┘  └──────────────┘           │
                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Wire Protocol

The Wire Protocol is a JSON-RPC 2.0-based communication protocol over stdio that enables bidirectional communication between the VS Code extension and kimi-code-cli.

### Protocol Stack

```
┌─────────────────────────────────────┐
│         Application Layer           │
│    (Turns, Steps, Content Parts)    │
├─────────────────────────────────────┤
│         JSON-RPC 2.0 Layer          │
│    (Methods, Notifications, Errors) │
├─────────────────────────────────────┤
│          Message Layer              │
│    (Envelope with id, method,       │
│     params, result, error)          │
├─────────────────────────────────────┤
│          Transport Layer            │
│    (stdio over child_process)       │
└─────────────────────────────────────┘
```

### Message Format

```typescript
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "sendMessage",
  "params": {
    "content": "Hello, Kimi!",
    "context": { ... }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { ... }
}

// Notification (Event)
{
  "jsonrpc": "2.0",
  "method": "TurnBegin",
  "params": { ... }
}
```

### Event Types

| Event | Direction | Description |
|-------|-----------|-------------|
| `TurnBegin` | Server → Client | New conversation turn started |
| `TurnEnd` | Server → Client | Turn completed/interrupted/error |
| `StepBegin` | Server → Client | Step (thinking/tool/response) started |
| `StepEnd` | Server → Client | Step completed |
| `ContentPart` | Server → Client | Text chunk or content piece |
| `ToolCall` | Server → Client | Tool execution requested |
| `ToolResult` | Server → Client | Tool execution result |
| `ApprovalRequest` | Server → Client | User approval needed |
| `StatusUpdate` | Server → Client | Connection status changed |
| `Error` | Server → Client | Error occurred |

### Methods

| Method | Params | Result | Description |
|--------|--------|--------|-------------|
| `sendMessage` | `{ content, context }` | `void` | Send user message |
| `interruptTurn` | `{ turn_id }` | `void` | Interrupt current turn |
| `submitApproval` | `{ request_id, approved }` | `void` | Respond to approval |
| `ping` | `{}` | `pong` | Health check |

## Communication Flow

### Inline Edit Flow

```
User                                          Extension
 │                                               │
 │  1. Select code                               │
 │  2. Press Cmd+K                               │
 ├──────────────────────────────────────────────>│
 │                                               │
 │  3. Show inline input box                     │
 │<──────────────────────────────────────────────┤
 │                                               │
 │  4. Type "Add error handling"                 │
 ├──────────────────────────────────────────────>│
 │                                               │
 │                    ┌─────────────────────┐    │
 │                    │   Build context     │    │
 │                    │   (file, selection) │    │
 │                    └──────────┬──────────┘    │
 │                               │               │
 │                    ┌──────────▼──────────┐    │
 │                    │  Generate prompt    │    │
 │                    └──────────┬──────────┘    │
 │                               │               │
 │                    ┌──────────▼──────────┐    │
 │                    │  Call Kimi API      │    │
 │                    │  (HTTP or Wire)     │    │
 │                    └──────────┬──────────┘    │
 │                               │               │
 │  5. Show loading indicator    │               │
 │<──────────────────────────────┤               │
 │                               │               │
 │  6. Stream/provide response   │               │
 │<──────────────────────────────┤               │
 │                               │               │
 │  7. Show diff view            │               │
 │<──────────────────────────────┤               │
 │                                               │
 │  8. Accept (Cmd+Enter) or Reject (Esc)       │
 ├──────────────────────────────────────────────>│
 │                                               │
 │  9. Apply edit / Discard                      │
 │<──────────────────────────────────────────────┤
 │                                               │

```

### Wire Protocol Connection Flow

```
Extension                WireClient              kimi-cli
    │                        │                       │
    │    1. connect()        │                       │
    ├───────────────────────>│                       │
    │                        │   2. spawn process    │
    │                        ├──────────────────────>│
    │                        │                       │
    │                        │   3. setup stdio      │
    │                        │<──────────────────────┤
    │                        │                       │
    │                        │   4. JSON-RPC         │
    │                        │<══════════════════════┤
    │    5. "connected"      │                       │
    │<───────────────────────│                       │
    │                        │                       │
    │    6. sendMessage()    │                       │
    ├───────────────────────>│                       │
    │                        │   7. write to stdin   │
    │                        ├──────────────────────>│
    │                        │                       │
    │                        │   8. response on      │
    │                        │      stdout           │
    │                        │<──────────────────────┤
    │    9. "ContentPart"    │                       │
    │<───────────────────────│                       │
    │                        │                       │
    │    10. disconnect()    │                       │
    ├───────────────────────>│   11. SIGTERM         │
    │                        ├──────────────────────>│
    │                        │                       │
```

## Project Structure

```
kimi-vscode/
├── .vscode/                  # VS Code settings for development
├── docs/                     # Documentation
├── node_modules/             # Dependencies
├── out/                      # Compiled JavaScript
├── resources/                # Icons and assets
├── scripts/                  # Build and utility scripts
│   ├── build.js
│   ├── package.js
│   └── install-local.js
├── src/                      # Source code
│   ├── commands/             # Command implementations
│   │   ├── index.ts
│   │   └── terminalCommands.ts
│   ├── context/              # Context management
│   │   ├── codebaseIndexer.ts
│   │   ├── contextResolver.ts
│   │   ├── index.ts
│   │   ├── promptBuilder.ts
│   │   └── symbolProvider.ts
│   ├── kimi/                 # Kimi API and Wire Protocol
│   │   ├── apiAdapter.ts     # Main API adapter
│   │   ├── client.ts
│   │   ├── index.ts
│   │   ├── kimiClient.ts
│   │   ├── wire.ts           # Wire Protocol client
│   │   └── wireTypes.ts      # Protocol types
│   ├── lsp/                  # Language Server Protocol
│   │   ├── completionProvider.ts
│   │   ├── hoverProvider.ts
│   │   ├── index.ts
│   │   ├── kimiLanguageClient.ts
│   │   ├── kimiLanguageServer.ts
│   │   └── signatureHelpProvider.ts
│   ├── panels/               # WebView panels
│   │   ├── chatPanel.ts
│   │   ├── index.ts
│   │   └── messageRenderer.ts
│   ├── providers/            # VS Code providers
│   │   ├── CodeActionProvider.ts
│   │   ├── DiffProvider.ts
│   │   ├── InlineEditProvider.ts
│   │   └── inlineEdit.ts
│   ├── terminal/             # Terminal integration
│   │   ├── shellIntegration.ts
│   │   ├── terminalLinkProvider.ts
│   │   └── terminalManager.ts
│   ├── test/                 # Test files
│   │   ├── mocks/
│   │   ├── runTest.ts
│   │   └── suite/
│   ├── types/                # Type definitions
│   │   └── index.ts
│   ├── utils/                # Utility functions
│   │   ├── asyncUtils.ts
│   │   ├── codeUtils.ts
│   │   ├── commands.ts
│   │   ├── constants.ts
│   │   ├── editorUtils.ts
│   │   ├── fileUtils.ts
│   │   ├── index.ts
│   │   ├── logger.ts
│   │   ├── markdownUtils.ts
│   │   └── types.ts
│   ├── config.ts             # Configuration management
│   ├── extension.ts          # Extension entry point
│   └── statusBar.ts          # Status bar UI
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript config
├── webpack.config.js         # Webpack config
└── Makefile                  # Build automation
```

## Key Components

### 1. Extension Entry Point (`src/extension.ts`)

Main activation and lifecycle management:

```typescript
export function activate(context: vscode.ExtensionContext) {
    // Initialize API adapter
    const kimiApi = new KimiApi();
    
    // Initialize providers
    const diffProvider = new DiffProvider();
    const inlineEditProvider = new InlineEditProvider(kimiApi, diffProvider);
    
    // Start LSP client
    const languageClient = new KimiLanguageClient(context);
    await languageClient.start();
    
    // Register commands and providers
    registerCommands(context, kimiApi);
    registerProviders(context, kimiApi);
}
```

### 2. API Adapter (`src/kimi/apiAdapter.ts`)

Unified interface for both HTTP and Wire Protocol modes:

```typescript
export class KimiApi {
    async generateResponse(prompt: string, options?: KimiApiOptions): Promise<KimiApiResponse>
    async generateEdit(prompt: string, options?: KimiApiOptions): Promise<KimiApiResponse>
    async *streamResponse(prompt: string, options?: KimiApiOptions): AsyncGenerator<string>
    async validateApiKey(): Promise<{ valid: boolean; message: string }>
}
```

### 3. Wire Client (`src/kimi/wire.ts`)

JSON-RPC client for kimi-cli communication:

```typescript
export class WireClient extends EventEmitter {
    async connect(): Promise<void>
    async disconnect(): Promise<void>
    async sendMessage(content: string, context?: unknown): Promise<unknown>
    async interruptTurn(turnId: string): Promise<void>
    async submitApproval(requestId: string, approved: boolean): Promise<void>
}
```

### 4. Inline Edit Provider (`src/providers/InlineEditProvider.ts`)

Handles inline editing workflow:

```typescript
export class InlineEditProvider implements vscode.Disposable {
    async showInlineEditBox(editor: vscode.TextEditor): Promise<void>
    async processEdit(selection: vscode.Selection, instruction: string): Promise<void>
    async acceptEdit(): Promise<void>
    async rejectEdit(): Promise<void>
}
```

### 5. LSP Client (`src/lsp/kimiLanguageClient.ts`)

Language Server Protocol client for advanced features:

```typescript
export class KimiLanguageClient implements vscode.Disposable {
    async start(): Promise<void>
    stop(): void
    isRunning(): boolean
}
```

## Data Flow

### Request Processing

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ User Action  │────>│   Command    │────>│   Provider   │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                        ┌────────▼────────┐
                                        │ Context Builder │
                                        │  • Current file │
                                        │  • Selection    │
                                        │  • Open files   │
                                        └────────┬────────┘
                                                 │
                                        ┌────────▼────────┐
                                        │  Prompt Builder │
                                        │  • System msg   │
                                        │  • User msg     │
                                        │  • Context      │
                                        └────────┬────────┘
                                                 │
                                        ┌────────▼────────┐
                                        │   KimiApi       │
                                        │  (HTTP/Wire)    │
                                        └────────┬────────┘
                                                 │
                              ┌──────────────────┴──────────────────┐
                              ▼                                     ▼
                    ┌───────────────────┐                 ┌───────────────────┐
                    │    HTTP Mode      │                 │   Wire Mode       │
                    │ • fetch()         │                 │ • JSON-RPC        │
                    │ • REST API        │                 │ • Streaming       │
                    └─────────┬─────────┘                 └─────────┬─────────┘
                              │                                     │
                              ▼                                     ▼
                    ┌───────────────────┐                 ┌───────────────────┐
                    │ Moonshot AI API   │                 │   kimi-code-cli   │
                    └───────────────────┘                 └───────────────────┘
```

### Response Processing

```
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│   AI Response     │────>│  Response Parser  │────>│  Content Extract  │
└───────────────────┘     └───────────────────┘     └─────────┬─────────┘
                                                              │
                              ┌───────────────────────────────┼───────────┐
                              ▼                               ▼           ▼
                    ┌───────────────────┐         ┌───────────────────┐  ┌───────────────────┐
                    │   Diff View       │         │   Inline Preview  │  │   Chat Panel      │
                    │   (for edits)     │         │   (ghost text)    │  │   (Q&A)           │
                    └───────────────────┘         └───────────────────┘  └───────────────────┘
```

## Extension Activation

```
VS Code Startup
      │
      ▼
┌──────────────┐
│  Extension   │
│  Detected    │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ Check if API │────>│ Show Welcome │
│ Key Exists   │ NO  │ Message      │
└──────┬───────┘     └──────────────┘
       │ YES
       ▼
┌──────────────┐
│ Initialize   │
│ Providers    │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ Check kimi   │ YES │ Start Wire   │
│ CLI Installed├────>│ Protocol     │
└──────┬───────┘     └──────────────┘
       │ NO
       ▼
┌──────────────┐
│ Use HTTP     │
│ Mode Only    │
└──────────────┘
```

## Configuration Resolution

```
┌─────────────────────────────────────────────────────────────┐
│                    Configuration Sources                     │
│                                                              │
│  1. VS Code Settings (highest priority)                     │
│     └─ workspace settings > user settings                   │
│                                                              │
│  2. Environment Variables                                   │
│     └─ ${env:KIMI_API_KEY}                                  │
│                                                              │
│  3. kimi-cli Config                                         │
│     └─ ~/.kimi/config.json                                  │
│     └─ ~/.config/kimi/config.json                           │
│                                                              │
│  4. Default Values (lowest priority)                        │
│     └─ Defined in src/config.ts                             │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling Strategy

```
┌───────────────────┐
│   Error Types     │
├───────────────────┤
│ • API errors      │
│ • Network errors  │
│ • Config errors   │
│ • Protocol errors │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Error Handler    │
├───────────────────┤
│ 1. Log to console │
│ 2. Show user msg  │
│ 3. Fallback mode  │
└───────────────────┘
```
